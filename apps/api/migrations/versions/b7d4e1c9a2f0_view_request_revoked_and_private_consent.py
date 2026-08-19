"""add view-request revoked status and clear private consent

Revision ID: b7d4e1c9a2f0
Revises: c4e8a2b6d0f1
Create Date: 2026-08-20 06:10:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "b7d4e1c9a2f0"
down_revision = "c4e8a2b6d0f1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint(
        "ck_directory_view_requests_status",
        "directory_view_requests",
        type_="check",
    )
    op.create_check_constraint(
        "ck_directory_view_requests_status",
        "directory_view_requests",
        "status IN ('pending', 'accepted', 'declined', 'revoked')",
    )
    op.execute(
        sa.text(
            "UPDATE members SET directory_consent_at = NULL "
            "WHERE visibility = 'private'"
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE directory_view_requests SET status = 'declined' "
            "WHERE status = 'revoked'"
        )
    )
    op.drop_constraint(
        "ck_directory_view_requests_status",
        "directory_view_requests",
        type_="check",
    )
    op.create_check_constraint(
        "ck_directory_view_requests_status",
        "directory_view_requests",
        "status IN ('pending', 'accepted', 'declined')",
    )
