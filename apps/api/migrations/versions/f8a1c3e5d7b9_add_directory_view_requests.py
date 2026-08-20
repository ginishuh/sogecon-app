"""add directory_view_requests table

Revision ID: f8a1c3e5d7b9
Revises: e7f3a2b4c8d1
Create Date: 2026-08-19 19:10:00.000000

"""

from alembic import op
import sqlalchemy as sa


revision = "f8a1c3e5d7b9"
down_revision = "e7f3a2b4c8d1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "directory_view_requests",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("requester_id", sa.Integer(), nullable=False),
        sa.Column("target_id", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=16),
            server_default="pending",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('pending', 'accepted', 'declined')",
            name="ck_directory_view_requests_status",
        ),
        sa.CheckConstraint(
            "requester_id <> target_id",
            name="ck_directory_view_requests_not_self",
        ),
        sa.ForeignKeyConstraint(
            ["requester_id"], ["members.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["target_id"], ["members.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "requester_id",
            "target_id",
            name="uq_directory_view_requests_pair",
        ),
    )
    op.create_index(
        "ix_directory_view_requests_requester_id",
        "directory_view_requests",
        ["requester_id"],
        unique=False,
    )
    op.create_index(
        "ix_directory_view_requests_target_id",
        "directory_view_requests",
        ["target_id"],
        unique=False,
    )
    op.create_index(
        "ix_directory_view_requests_target_status",
        "directory_view_requests",
        ["target_id", "status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_directory_view_requests_target_status",
        table_name="directory_view_requests",
    )
    op.drop_index(
        "ix_directory_view_requests_target_id",
        table_name="directory_view_requests",
    )
    op.drop_index(
        "ix_directory_view_requests_requester_id",
        table_name="directory_view_requests",
    )
    op.drop_table("directory_view_requests")
