"""전용 폐기 DB에서 두 실제 PostgreSQL 세션의 경쟁을 검증한다."""
import os
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4
import pytest
import sqlalchemy as sa
from sqlalchemy.orm import Session
from test_channel_connection_state import KEY, event


@pytest.fixture
def pg_state():
    value = os.environ.get("CGA_CHANNEL_MIGRATION_TEST_URL")
    if not value: pytest.skip("dedicated disposable PostgreSQL env required")
    url = sa.engine.make_url(value)
    assert url.get_backend_name() == "postgresql" and url.host in {"localhost", "127.0.0.1", "::1"}
    assert url.database == "cga_channel_migration_test"
    engine = sa.create_engine(url, hide_parameters=True)
    schema = "task5_" + uuid4().hex
    with engine.begin() as db: db.execute(sa.text(f'CREATE SCHEMA "{schema}"'))
    scoped = sa.create_engine(url, hide_parameters=True, connect_args={"options":
        f"-csearch_path={schema} -cstatement_timeout=15000 -clock_timeout=10000"})
    from test_channel_connection_migrations import scripts, migrate
    directory = scripts()
    try:
        with scoped.begin() as db:
            migrate(db, list(reversed(list(directory.walk_revisions(base="base", head="heads")))), "upgrade")
        from app.models import Organization, Group, Bot, AdminChannel, ChannelConnection
        with Session(scoped) as db:
            org = Organization(name="QA", code="qa")
            db.add(org); db.flush()
            group = Group(organization_id=org.id, name="QA", code="qa")
            channel = AdminChannel(organization_id=org.id, name="QA", code="SLACK")
            db.add_all([group, channel]); db.flush()
            bot = Bot(organization_id=org.id, group_id=group.id, name="QA")
            db.add(bot); db.flush()
            row = ChannelConnection(organization_id=org.id, bot_id=bot.id, channel_id=channel.id,
                name="QA", provider="slack", installation_id="i", account_id="a", target_id="t",
                desired_state="connected", observed_state="connecting")
            db.add(row); db.flush(); row_id = row.id; db.commit()
        yield scoped, row_id
    finally:
        scoped.dispose()
        with engine.begin() as db: db.execute(sa.text(f'DROP SCHEMA "{schema}" CASCADE'))
        engine.dispose()


def test_two_workers_real_pg_single_lease_and_fence(pg_state):
    from app.models import ChannelConnection
    from app.services import channel_connection_state as s
    engine, connection_id = pg_state
    barrier = Barrier(2)
    def compete(owner):
        with Session(engine) as db:
            row = db.get(ChannelConnection, connection_id)
            barrier.wait(timeout=10)
            lease = s.claim_installation(db, row, owner, ttl_seconds=30)
            result = (owner, lease.id, lease.fence) if lease else None
            db.commit(); return result
    with ThreadPoolExecutor(2) as pool:
        results = list(pool.map(compete, ["worker-1", "worker-2"]))
    assert len([x for x in results if x is not None]) == 1
    winner, lease_id, fence = next(x for x in results if x is not None)
    assert fence == 1
    with Session(engine) as db:
        s.activate_connection(db, connection_id, lease_id, winner, 1, {"installation_id": "i", "account_id": "a"})
        db.commit()
    barrier = Barrier(2)
    def accept(_):
        with Session(engine) as db:
            barrier.wait(timeout=10)
            item = s.accept_delivery(db, connection_id, lease_id, winner, 1, event(), key=KEY, version="v1")
            identity = item.id; db.commit(); return identity
    with ThreadPoolExecutor(2) as pool: ids = list(pool.map(accept, range(2)))
    assert ids[0] == ids[1]
    barrier = Barrier(2)
    def claim(_):
        with Session(engine) as db:
            barrier.wait(timeout=10)
            item = s.claim_delivery(db, connection_id, lease_id, winner, 1, deadline_seconds=30)
            result = item.execution_claim_id if item else None
            db.commit(); return result
    with ThreadPoolExecutor(2) as pool: claims = list(pool.map(claim, range(2)))
    assert len([x for x in claims if x is not None]) == 1
    with Session(engine) as db:
        s.mark_ready(db, ids[0], {}, next(x for x in claims if x), lease_id, winner, 1)
        db.commit()
    barrier = Barrier(2)
    def send(_):
        with Session(engine) as db:
            barrier.wait(timeout=10)
            result = s.claim_send(db, ids[0], lease_id, winner, 1)
            db.commit(); return result
    with ThreadPoolExecutor(2) as pool: sends = list(pool.map(send, range(2)))
    assert len([x for x in sends if x is not None]) == 1
    with Session(engine) as db:
        assert s.mark_unknown(db, ids[0], next(x for x in sends if x), "DELIVERY_UNKNOWN")
        db.commit()
    with Session(engine) as db:
        assert s.claim_send(db, ids[0], lease_id, winner, 1) is None
