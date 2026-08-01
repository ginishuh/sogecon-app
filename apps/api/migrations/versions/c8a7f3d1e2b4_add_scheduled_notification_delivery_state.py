"""add scheduled notification delivery state

Revision ID: c8a7f3d1e2b4
Revises: b8e6d1f4a2c7
Create Date: 2026-08-01 10:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


revision = "c8a7f3d1e2b4"
down_revision = "b8e6d1f4a2c7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "scheduled_notification_logs",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_table(
        "scheduled_notification_deliveries",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("scheduled_log_id", sa.Integer(), nullable=False),
        sa.Column("endpoint_hash", sa.String(length=64), nullable=False),
        sa.Column(
            "status",
            sa.String(length=16),
            server_default="pending",
            nullable=False,
        ),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["scheduled_log_id"],
            ["scheduled_notification_logs.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "scheduled_log_id",
            "endpoint_hash",
            name="uq_scheduled_notification_delivery_log_endpoint",
        ),
    )
    op.create_index(
        "ix_scheduled_notification_deliveries_scheduled_log_id",
        "scheduled_notification_deliveries",
        ["scheduled_log_id"],
        unique=False,
    )
    op.create_index(
        "ix_scheduled_notification_delivery_log_status",
        "scheduled_notification_deliveries",
        ["scheduled_log_id", "status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_scheduled_notification_delivery_log_status",
        table_name="scheduled_notification_deliveries",
    )
    op.drop_index(
        "ix_scheduled_notification_deliveries_scheduled_log_id",
        table_name="scheduled_notification_deliveries",
    )
    op.drop_table("scheduled_notification_deliveries")
    op.drop_column("scheduled_notification_logs", "updated_at")
