"""add member status and signup requests

Revision ID: 9ab3c7d4e1f2
Revises: 402476456470
Create Date: 2026-02-18 09:35:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9ab3c7d4e1f2"
down_revision: str | None = "402476456470"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "members",
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=True,
            server_default="active",
        ),
    )
    op.execute(sa.text("UPDATE members SET status = 'active' WHERE status IS NULL"))
    op.create_check_constraint(
        "ck_members_status",
        "members",
        "status IN ('pending', 'active', 'suspended', 'rejected')",
    )
    op.alter_column(
        "members",
        "status",
        existing_type=sa.String(length=16),
        nullable=False,
        server_default="active",
    )
    op.create_index(op.f("ix_members_status"), "members", ["status"], unique=False)

    op.create_table(
        "signup_requests",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("student_id", sa.String(length=20), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("cohort", sa.Integer(), nullable=False),
        sa.Column("major", sa.String(length=255), nullable=True),
        sa.Column(
            "status",
            sa.String(length=16),
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
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decided_by_student_id", sa.String(length=20), nullable=True),
        sa.Column("reject_reason", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_check_constraint(
        "ck_signup_requests_status",
        "signup_requests",
        "status IN ('pending', 'approved', 'rejected', 'activated')",
    )
    op.create_index(
        op.f("ix_signup_requests_student_id"),
        "signup_requests",
        ["student_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_signup_requests_email"),
        "signup_requests",
        ["email"],
        unique=False,
    )
    op.create_index(
        op.f("ix_signup_requests_status"),
        "signup_requests",
        ["status"],
        unique=False,
    )
    op.create_index(
        "ix_signup_requests_status_requested_at",
        "signup_requests",
        ["status", "requested_at"],
        unique=False,
    )
    op.create_index(
        "uq_signup_requests_student_id_pending",
        "signup_requests",
        ["student_id"],
        unique=True,
        postgresql_where=sa.text("status = 'pending'"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_signup_requests_student_id_pending",
        table_name="signup_requests",
        postgresql_where=sa.text("status = 'pending'"),
    )
    op.drop_index(
        "ix_signup_requests_status_requested_at",
        table_name="signup_requests",
    )
    op.drop_index(op.f("ix_signup_requests_status"), table_name="signup_requests")
    op.drop_index(op.f("ix_signup_requests_email"), table_name="signup_requests")
    op.drop_index(op.f("ix_signup_requests_student_id"), table_name="signup_requests")
    op.drop_constraint("ck_signup_requests_status", "signup_requests", type_="check")
    op.drop_table("signup_requests")

    op.drop_index(op.f("ix_members_status"), table_name="members")
    op.drop_constraint("ck_members_status", "members", type_="check")
    op.drop_column("members", "status")
