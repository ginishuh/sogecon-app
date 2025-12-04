"""add_created_at_to_scheduled_notification_logs

Revision ID: 852f8707bed6
Revises: a3d573e4dad9
Create Date: 2025-12-04 13:43:54.833487

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '852f8707bed6'
down_revision = 'a3d573e4dad9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'scheduled_notification_logs',
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False)
    )


def downgrade() -> None:
    op.drop_column('scheduled_notification_logs', 'created_at')