"""add support tickets

Revision ID: e7b4c2d9a1f6
Revises: c5a7d9e1f2b3
Create Date: 2026-07-14 05:25:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e7b4c2d9a1f6"
down_revision: str | None = "c5a7d9e1f2b3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "support_tickets",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("member_email", sa.String(length=255), nullable=True),
        sa.Column("subject", sa.String(length=120), nullable=False),
        sa.Column("body", sa.String(length=10_000), nullable=False),
        sa.Column("contact", sa.String(length=120), nullable=True),
        sa.Column("client_ip", sa.String(length=64), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_support_tickets_member_email",
        "support_tickets",
        ["member_email"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_support_tickets_member_email",
        table_name="support_tickets",
    )
    op.drop_table("support_tickets")
