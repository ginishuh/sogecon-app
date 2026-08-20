"""add members.directory_consent_at

Revision ID: d9e1f3a5b7c9
Revises: f8a1c3e5d7b9
Create Date: 2026-08-19 20:15:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "d9e1f3a5b7c9"
down_revision = "f8a1c3e5d7b9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "members",
        sa.Column("directory_consent_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute(
        sa.text(
            "UPDATE members SET directory_consent_at = created_at "
            "WHERE directory_consent_at IS NULL"
        )
    )


def downgrade() -> None:
    op.drop_column("members", "directory_consent_at")
