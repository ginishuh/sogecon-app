"""record activation email send audit on issue logs

Revision ID: c9e4a1b7d2f0
Revises: b7d4e1c9a2f0
Create Date: 2026-08-23 18:55:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c9e4a1b7d2f0"
down_revision: str | None = "b7d4e1c9a2f0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "signup_activation_issue_logs",
        sa.Column("recipient_masked", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "signup_activation_issue_logs",
        sa.Column("related_issue_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_signup_activation_issue_logs_related_issue_id",
        "signup_activation_issue_logs",
        "signup_activation_issue_logs",
        ["related_issue_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.drop_constraint(
        "ck_signup_activation_issue_logs_issued_type",
        "signup_activation_issue_logs",
        type_="check",
    )
    op.create_check_constraint(
        "ck_signup_activation_issue_logs_issued_type",
        "signup_activation_issue_logs",
        "issued_type IN ('approve', 'reissue', 'send')",
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "DELETE FROM signup_activation_issue_logs WHERE issued_type = 'send'"
        )
    )
    op.drop_constraint(
        "ck_signup_activation_issue_logs_issued_type",
        "signup_activation_issue_logs",
        type_="check",
    )
    op.create_check_constraint(
        "ck_signup_activation_issue_logs_issued_type",
        "signup_activation_issue_logs",
        "issued_type IN ('approve', 'reissue')",
    )
    op.drop_constraint(
        "fk_signup_activation_issue_logs_related_issue_id",
        "signup_activation_issue_logs",
        type_="foreignkey",
    )
    op.drop_column("signup_activation_issue_logs", "related_issue_id")
    op.drop_column("signup_activation_issue_logs", "recipient_masked")
