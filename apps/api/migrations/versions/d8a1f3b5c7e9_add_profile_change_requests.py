"""add profile_change_requests table

Revision ID: d8a1f3b5c7e9
Revises: c7f4e2a9d1b3
Create Date: 2026-02-22 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "d8a1f3b5c7e9"
down_revision = "c7f4e2a9d1b3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "profile_change_requests",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("member_id", sa.Integer(), nullable=False),
        sa.Column("field_name", sa.String(16), nullable=False),
        sa.Column("old_value", sa.String(255), nullable=False),
        sa.Column("new_value", sa.String(255), nullable=False),
        sa.Column(
            "status",
            sa.String(16),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "requested_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decided_by_student_id", sa.String(20), nullable=True),
        sa.Column("reject_reason", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["member_id"],
            ["members.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "status IN ('pending', 'approved', 'rejected')",
            name="ck_profile_change_requests_status",
        ),
        sa.CheckConstraint(
            "field_name IN ('name', 'cohort')",
            name="ck_profile_change_requests_field_name",
        ),
    )
    op.create_index(
        "ix_profile_change_requests_member_id",
        "profile_change_requests",
        ["member_id"],
    )
    op.create_index(
        "ix_profile_change_requests_status",
        "profile_change_requests",
        ["status"],
    )
    op.create_index(
        "ix_profile_change_requests_status_requested_at",
        "profile_change_requests",
        ["status", "requested_at"],
    )
    op.create_index(
        "uq_profile_change_requests_member_field_pending",
        "profile_change_requests",
        ["member_id", "field_name"],
        unique=True,
        postgresql_where=sa.text("status = 'pending'"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_profile_change_requests_member_field_pending",
        table_name="profile_change_requests",
    )
    op.drop_index(
        "ix_profile_change_requests_status_requested_at",
        table_name="profile_change_requests",
    )
    op.drop_index(
        "ix_profile_change_requests_status",
        table_name="profile_change_requests",
    )
    op.drop_index(
        "ix_profile_change_requests_member_id",
        table_name="profile_change_requests",
    )
    op.drop_table("profile_change_requests")
