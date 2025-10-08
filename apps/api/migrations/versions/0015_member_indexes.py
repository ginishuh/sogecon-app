"""add indexes for member sorting

Revision ID: 0015_member_indexes
Revises: 0014_member_timestamps
Create Date: 2025-10-09 01:05:00.000000
"""

from __future__ import annotations

from alembic import op


# revision identifiers, used by Alembic.
revision = "0015_member_indexes"
down_revision = "0014_member_timestamps"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_members_updated_at", "members", ["updated_at"], unique=False)
    op.create_index("ix_members_cohort_name", "members", ["cohort", "name"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_members_cohort_name", table_name="members")
    op.drop_index("ix_members_updated_at", table_name="members")
