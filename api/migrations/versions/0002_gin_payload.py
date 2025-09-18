"""gin index on versions.payload"""
revision = "0002_gin_payload"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None

from alembic import op

def upgrade():
    op.execute("CREATE INDEX IF NOT EXISTS versions_payload_gin ON versions USING GIN (payload)")

def downgrade():
    op.execute("DROP INDEX IF EXISTS versions_payload_gin")
