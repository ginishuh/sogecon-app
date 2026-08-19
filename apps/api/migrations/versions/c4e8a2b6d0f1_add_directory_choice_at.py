"""add members.directory_choice_at

Revision ID: c4e8a2b6d0f1
Revises: d9e1f3a5b7c9
Create Date: 2026-08-19 21:20:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "c4e8a2b6d0f1"
down_revision = "d9e1f3a5b7c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "members",
        sa.Column("directory_choice_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute(
        sa.text(
            "UPDATE members SET directory_choice_at = "
            "COALESCE(directory_consent_at, created_at) "
            "WHERE directory_choice_at IS NULL"
        )
    )


def downgrade() -> None:
    op.drop_column("members", "directory_choice_at")
