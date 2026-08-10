"""add upload_assets table

Revision ID: e7f3a2b4c8d1
Revises: d5f2a1c9e7b3
Create Date: 2026-08-11 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "e7f3a2b4c8d1"
down_revision = "d5f2a1c9e7b3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "upload_assets",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("owner_member_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("path", sa.String(length=512), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "kind IN ('image', 'avatar')",
            name="ck_upload_assets_kind",
        ),
        sa.ForeignKeyConstraint(
            ["owner_member_id"],
            ["members.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_upload_assets_owner_kind",
        "upload_assets",
        ["owner_member_id", "kind"],
        unique=False,
    )
    op.create_index(
        op.f("ix_upload_assets_owner_member_id"),
        "upload_assets",
        ["owner_member_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_upload_assets_owner_member_id"), table_name="upload_assets")
    op.drop_index("ix_upload_assets_owner_kind", table_name="upload_assets")
    op.drop_table("upload_assets")
