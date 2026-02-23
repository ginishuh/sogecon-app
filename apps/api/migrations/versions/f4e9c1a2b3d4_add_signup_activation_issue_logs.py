"""add signup_activation_issue_logs table

Revision ID: f4e9c1a2b3d4
Revises: e1a2b3c4d5f6
Create Date: 2026-02-23 20:20:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f4e9c1a2b3d4"
down_revision: str | None = "e1a2b3c4d5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "signup_activation_issue_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("signup_request_id", sa.Integer(), nullable=False),
        sa.Column("issued_type", sa.String(length=16), nullable=False),
        sa.Column("issued_by_student_id", sa.String(length=20), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("token_tail", sa.String(length=16), nullable=True),
        sa.Column(
            "issued_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["signup_request_id"],
            ["signup_requests.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "issued_type IN ('approve', 'reissue')",
            name="ck_signup_activation_issue_logs_issued_type",
        ),
    )
    op.create_index(
        "ix_signup_activation_issue_logs_signup_request_id",
        "signup_activation_issue_logs",
        ["signup_request_id"],
    )
    op.create_index(
        "ix_signup_activation_issue_logs_issued_type",
        "signup_activation_issue_logs",
        ["issued_type"],
    )
    op.create_index(
        "ix_signup_activation_issue_logs_issued_by_student_id",
        "signup_activation_issue_logs",
        ["issued_by_student_id"],
    )
    op.create_index(
        "ix_signup_activation_issue_logs_token_hash",
        "signup_activation_issue_logs",
        ["token_hash"],
    )
    op.create_index(
        "ix_signup_activation_issue_logs_issued_at",
        "signup_activation_issue_logs",
        ["issued_at"],
    )
    op.create_index(
        "ix_signup_activation_issue_logs_request_issued_at",
        "signup_activation_issue_logs",
        ["signup_request_id", "issued_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_signup_activation_issue_logs_request_issued_at",
        table_name="signup_activation_issue_logs",
    )
    op.drop_index(
        "ix_signup_activation_issue_logs_issued_at",
        table_name="signup_activation_issue_logs",
    )
    op.drop_index(
        "ix_signup_activation_issue_logs_token_hash",
        table_name="signup_activation_issue_logs",
    )
    op.drop_index(
        "ix_signup_activation_issue_logs_issued_by_student_id",
        table_name="signup_activation_issue_logs",
    )
    op.drop_index(
        "ix_signup_activation_issue_logs_issued_type",
        table_name="signup_activation_issue_logs",
    )
    op.drop_index(
        "ix_signup_activation_issue_logs_signup_request_id",
        table_name="signup_activation_issue_logs",
    )
    op.drop_table("signup_activation_issue_logs")
