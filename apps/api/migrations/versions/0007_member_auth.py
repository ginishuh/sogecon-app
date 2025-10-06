"""member auth table

Revision ID: 0007_member_auth
Revises: 0006_notification_send_logs
Create Date: 2025-10-07
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0007_member_auth"
down_revision = "0006_notification_send_logs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "member_auth",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("member_id", sa.Integer(), sa.ForeignKey("members.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )
    op.create_index("ix_member_auth_member_id", "member_auth", ["member_id"], unique=False)
    op.create_index("ix_member_auth_email", "member_auth", ["email"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_member_auth_email", table_name="member_auth")
    op.drop_index("ix_member_auth_member_id", table_name="member_auth")
    op.drop_table("member_auth")

