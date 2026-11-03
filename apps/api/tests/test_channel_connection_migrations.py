"""전용 환경변수로만 격리 PostgreSQL을 사용하는 migration 검사."""
import os
from pathlib import Path
from uuid import uuid4

import pytest
import sqlalchemy as sa
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory

ROOT = Path(__file__).resolve().parents[1]
REVISIONS = ["20261103_0028", "20261103_0029", "20261103_0030"]
TABLES = ["channel_connections", "channel_installation_leases", "channel_connection_rooms", "channel_connection_deliveries"]


def scripts():
    config = Config()
    config.set_main_option("script_location", str(ROOT / "alembic"))
    return ScriptDirectory.from_config(config)


def test_exact_additive_chain():
    directory = scripts()
    assert directory.get_current_head() == REVISIONS[-1]
    previous = "20260720_0027"
    for name in REVISIONS:
        revision = directory.get_revision(name)
        assert revision.down_revision == previous
        assert len(revision.revision) <= 32
        previous = name


@pytest.fixture
def db():
    url = os.environ.get("CGA_CHANNEL_MIGRATION_TEST_URL")
    if not url:
        pytest.skip("CGA_CHANNEL_MIGRATION_TEST_URL required: disposable PostgreSQL only")
    parsed = sa.engine.make_url(url)
    assert parsed.get_backend_name() == "postgresql"
    assert parsed.host in {"localhost", "127.0.0.1", "::1"}, "isolated local/forwarded PostgreSQL only"
    assert parsed.database == "cga_channel_migration_test", "dedicated disposable DB required"
    engine = sa.create_engine(url)
    with engine.connect() as connection:
        transaction = connection.begin()
        # Never run against an already populated database, even with explicit env.
        assert sa.inspect(connection).get_table_names() == [], "migration test DB must be empty"
        yield connection
        transaction.rollback()
    engine.dispose()


def migrate(db, revisions, direction):
    with Operations.context(MigrationContext.configure(db)):
        for revision in revisions:
            getattr(revision.module, direction)()


def baseline(db):
    directory = scripts()
    migrate(db, list(reversed(list(directory.walk_revisions(base="base", head="20260720_0027")))), "upgrade")
    return directory


def counts(db):
    return {name: db.execute(sa.text(f'SELECT count(*) FROM "{name}"')).scalar_one() for name in sa.inspect(db).get_table_names() if name not in TABLES}


def insert(db, model, **values):
    identity = uuid4()
    db.execute(sa.insert(model.__table__).values(id=identity, **values))
    return identity


def existing_entities(db):
    from app.models import Organization, Group, Bot, BotVersion, AdminChannel, ChannelRoom, ChannelMessage, ChannelQueueEvent
    org = insert(db, Organization, name="migration QA", code="migration-qa")
    group = insert(db, Group, organization_id=org, code="qa", name="QA")
    bot = insert(db, Bot, organization_id=org, group_id=group, name="QA")
    version = insert(db, BotVersion, bot_id=bot, version_no=1, name="QA")
    channel = insert(db, AdminChannel, organization_id=org, code="SLACK", name="QA")
    room = insert(db, ChannelRoom, channel_type="webchat", bot_id=bot, bot_version_id=version)
    message = insert(db, ChannelMessage, room_id=room, channel_type="webchat", participant_id="qa", participant_kind="user", participant_name="QA", text="sentinel")
    insert(db, ChannelQueueEvent, room_id=room, request_message_id=message, channel_type="webchat", bot_id=bot, bot_version_id=version)
    return org, bot, channel, room


def test_postgresql_upgrade_preserves_rows_and_empty_downgrade(db):
    directory = baseline(db)
    # Nonempty existing table sentinel makes preservation test meaningful.
    existing_entities(db)
    before = counts(db)
    revisions = [directory.get_revision(name) for name in REVISIONS]
    migrate(db, revisions, "upgrade")
    assert set(TABLES) <= set(sa.inspect(db).get_table_names())
    assert counts(db) == before
    migrate(db, reversed(revisions), "downgrade")
    assert not set(TABLES) & set(sa.inspect(db).get_table_names())
    assert counts(db) == before


@pytest.mark.parametrize("revision, table", [(REVISIONS[0], TABLES[0]), (REVISIONS[1], TABLES[1]), (REVISIONS[1], TABLES[2]), (REVISIONS[1], TABLES[3]), (REVISIONS[2], TABLES[1])])
def test_downgrade_refuses_data(db, revision, table):
    directory = baseline(db)
    selected = REVISIONS[: REVISIONS.index(revision) + 1]
    migrate(db, [directory.get_revision(name) for name in selected], "upgrade")
    from app.models import ChannelConnection, ChannelInstallationLease, ChannelConnectionRoom, ChannelConnectionDelivery
    org, bot, channel, room = existing_entities(db)
    connection = insert(db, ChannelConnection, organization_id=org, channel_id=channel, bot_id=bot, name="QA", provider="slack", installation_id="synthetic-installation", account_id="synthetic-account", target_id="synthetic-target")
    if table == "channel_installation_leases":
        # The 0029 table predates listener_scope_hash; use reflected metadata.
        lease_table = sa.Table(table, sa.MetaData(), autoload_with=db)
        values = dict(id=uuid4(), organization_id=org, provider="slack", installation_id="synthetic-installation", account_id="synthetic-account")
        if "listener_scope_hash" in lease_table.c:
            values["listener_scope_hash"] = "a" * 64
        db.execute(sa.insert(lease_table).values(**values))
    elif table == "channel_connection_rooms":
        insert(db, ChannelConnectionRoom, connection_id=connection, native_room_hash="a" * 64, room_id=room)
    elif table == "channel_connection_deliveries":
        insert(db, ChannelConnectionDelivery, organization_id=org, connection_id=connection, generation=1, installation_fence=1, native_room_hash="a" * 64, native_actor_hash="b" * 64, event_key="c" * 64, request_hash="d" * 64, event_json={})
    with pytest.raises(RuntimeError, match="[Pp]reserv|records exist|state exists"):
        migrate(db, [directory.get_revision(revision)], "downgrade")
    assert db.execute(sa.text(f'SELECT count(*) FROM "{table}"')).scalar_one() == 1


@pytest.mark.parametrize("revision", [REVISIONS[1], REVISIONS[2]])
def test_downgrade_refuses_lease_without_connection(db, revision):
    directory = baseline(db)
    selected = REVISIONS[: REVISIONS.index(revision) + 1]
    migrate(db, [directory.get_revision(name) for name in selected], "upgrade")
    from app.models import Organization
    org = insert(db, Organization, name="lease-only QA", code="lease-only-qa")
    lease_table = sa.Table("channel_installation_leases", sa.MetaData(), autoload_with=db)
    values = dict(id=uuid4(), organization_id=org, provider="slack", installation_id="synthetic-installation", account_id="synthetic-account")
    if "listener_scope_hash" in lease_table.c:
        values["listener_scope_hash"] = "a" * 64
    db.execute(sa.insert(lease_table).values(**values))
    # Fix the independent guard precondition: no connection/room/delivery can
    # accidentally satisfy another preservation guard before the lease check.
    for table in ["channel_connections", "channel_connection_rooms", "channel_connection_deliveries"]:
        assert db.execute(sa.text(f'SELECT count(*) FROM "{table}"')).scalar_one() == 0
    assert db.execute(sa.select(sa.func.count()).select_from(lease_table)).scalar_one() == 1
    before = set(sa.inspect(db).get_table_names())
    with pytest.raises(RuntimeError, match="[Pp]reserv|records exist|state exists"):
        migrate(db, [directory.get_revision(revision)], "downgrade")
    assert set(sa.inspect(db).get_table_names()) == before
    assert db.execute(sa.select(sa.func.count()).select_from(lease_table)).scalar_one() == 1
