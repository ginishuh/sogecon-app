"""notification preferences

Revision ID: 0005_notification_preference
Revises: 0004_push_subscription
Create Date: 2025-10-06
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0005_notification_preference"
down_revision = "0004_push_subscription"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notification_preferences",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("member_id", sa.Integer(), sa.ForeignKey("members.id", ondelete="CASCADE"), nullable=False),
        sa.Column("channel", sa.String(length=32), nullable=False),
        sa.Column("topic", sa.String(length=64), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_notification_preferences_member_id", "notification_preferences", ["member_id"]) 
    op.create_index("ix_notification_preferences_channel", "notification_preferences", ["channel"]) 


def downgrade() -> None:
    op.drop_index("ix_notification_preferences_channel", table_name="notification_preferences")
    op.drop_index("ix_notification_preferences_member_id", table_name="notification_preferences")
    op.drop_table("notification_preferences")
