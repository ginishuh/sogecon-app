"""add unique index to members phone

Revision ID: c7f4e2a9d1b3
Revises: b6d2e8f1c4a7
Create Date: 2026-02-20 00:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c7f4e2a9d1b3"
down_revision: str | None = "b6d2e8f1c4a7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(op.f("ix_members_phone"), "members", ["phone"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_members_phone"), table_name="members")

