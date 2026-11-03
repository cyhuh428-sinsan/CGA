"""외부 개별 설치와 검증된 앱 수신 연결을 구분한다. 자격증명/공개API 필드는 추가하지 않는다."""
from alembic import op
import sqlalchemy as sa
import hashlib,json
revision="20261103_0030"
down_revision="20261103_0029"
branch_labels=None
depends_on=None


def upgrade():
    op.add_column("channel_connections",sa.Column("listener_scope_hash",sa.String(64)))
    op.add_column("channel_installation_leases",sa.Column("listener_scope_hash",sa.String(64)))
    db=op.get_bind()
    rows=db.execute(sa.text("SELECT id, provider, installation_id, account_id FROM channel_installation_leases")).mappings().all()
    for row in rows:
        value=json.dumps([row['provider'],row['installation_id'],row['account_id']],ensure_ascii=False,separators=(',',':'))
        digest=hashlib.sha256(value.encode()).hexdigest()
        db.execute(sa.text("UPDATE channel_installation_leases SET listener_scope_hash=:scope WHERE id=:id"),{'scope':digest,'id':row['id']})
    op.alter_column("channel_installation_leases","listener_scope_hash",existing_type=sa.String(64),nullable=False)
    op.create_unique_constraint("uq_connection_listener_scope","channel_installation_leases",["organization_id","provider","listener_scope_hash"])
    op.drop_constraint("uq_connection_installation","channel_installation_leases",type_="unique")


def downgrade():
    for table in ["channel_connections", "channel_installation_leases", "channel_connection_rooms", "channel_connection_deliveries"]:
        if op.get_bind().execute(sa.text("SELECT EXISTS(SELECT 1 FROM " + table + ")")).scalar():
            raise RuntimeError("Listener state exists; preserve connection runtime records before downgrade")
    op.create_unique_constraint("uq_connection_installation","channel_installation_leases",["organization_id","provider","installation_id","account_id"])
    op.drop_constraint("uq_connection_listener_scope","channel_installation_leases",type_="unique")
    op.drop_column("channel_installation_leases","listener_scope_hash")
    op.drop_column("channel_connections","listener_scope_hash")
