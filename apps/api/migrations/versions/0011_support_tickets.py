"""create support_tickets

Revision ID: 0011_support_tickets
Revises: 0010_member_profile_fields
Create Date: 2025-10-07
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0011_support_tickets"
down_revision = "0010_member_profile_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "support_tickets",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("member_email", sa.String(length=255), nullable=True),
        sa.Column("subject", sa.String(length=120), nullable=False),
        sa.Column("body", sa.String(length=10000), nullable=False),
        sa.Column("contact", sa.String(length=120), nullable=True),
        sa.Column("client_ip", sa.String(length=64), nullable=True),
    )
    op.create_index("ix_support_tickets_member_email", "support_tickets", ["member_email"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_support_tickets_member_email", table_name="support_tickets")
    op.drop_table("support_tickets")

