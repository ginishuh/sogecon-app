"""add phone note to signup requests

Revision ID: b6d2e8f1c4a7
Revises: 9ab3c7d4e1f2
Create Date: 2026-02-18 10:25:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b6d2e8f1c4a7"
down_revision: str | None = "9ab3c7d4e1f2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "signup_requests",
        sa.Column("phone", sa.String(length=64), nullable=True),
    )
    op.add_column("signup_requests", sa.Column("note", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("signup_requests", "note")
    op.drop_column("signup_requests", "phone")
