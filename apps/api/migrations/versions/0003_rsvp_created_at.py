"""add rsvp.created_at

Revision ID: 0003_rsvp_created_at
Revises: 0002_admin_users
Create Date: 2025-10-06
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0003_rsvp_created_at"
down_revision = "0002_admin_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "rsvps",
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("rsvps", "created_at")

