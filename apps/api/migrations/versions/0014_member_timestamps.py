"""add created_at updated_at to members

Revision ID: 0014_member_timestamps
Revises: 0013_member_avatar
Create Date: 2025-10-08 22:30:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0014_member_timestamps"
down_revision = "0013_member_avatar"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "members",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.add_column(
        "members",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
            server_onupdate=sa.func.now(),
        ),
    )
    op.execute(
        "UPDATE members SET created_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP"
    )


def downgrade() -> None:
    op.drop_column("members", "updated_at")
    op.drop_column("members", "created_at")
