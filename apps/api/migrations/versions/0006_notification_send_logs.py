"""notification send logs

Revision ID: 0006_notification_send_logs
Revises: 0005_notification_preference
Create Date: 2025-10-06
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0006_notification_send_logs"
down_revision = "0005_notification_preference"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notification_send_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("ok", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("endpoint_hash", sa.String(length=64), nullable=False),
        sa.Column("endpoint_tail", sa.String(length=32), nullable=True),
    )
    op.create_index(
        "ix_notification_send_logs_created_at",
        "notification_send_logs",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        "ix_notification_send_logs_endpoint_hash",
        "notification_send_logs",
        ["endpoint_hash"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_notification_send_logs_endpoint_hash", table_name="notification_send_logs"
    )
    op.drop_index(
        "ix_notification_send_logs_created_at", table_name="notification_send_logs"
    )
    op.drop_table("notification_send_logs")

