"""member avatar path

Revision ID: 0013_member_avatar
Revises: 0012_member_post_extra_fields
Create Date: 2025-10-08 17:40:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0013_member_avatar"
down_revision = "0012_member_post_extra_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "members",
        sa.Column("avatar_path", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("members", "avatar_path")
