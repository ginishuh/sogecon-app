"""add member/post extra fields

Revision ID: 0012_member_post_extra_fields
Revises: 0011_support_tickets
Create Date: 2025-10-08
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0012_member_post_extra_fields"
down_revision = "0011_support_tickets"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Member profile enrichment fields
    op.add_column("members", sa.Column("company", sa.String(length=255), nullable=True))
    op.add_column("members", sa.Column("department", sa.String(length=255), nullable=True))
    op.add_column("members", sa.Column("job_title", sa.String(length=255), nullable=True))
    op.add_column("members", sa.Column("company_phone", sa.String(length=64), nullable=True))
    op.add_column("members", sa.Column("addr_personal", sa.String(length=255), nullable=True))
    op.add_column("members", sa.Column("addr_company", sa.String(length=255), nullable=True))
    op.add_column("members", sa.Column("industry", sa.String(length=255), nullable=True))

    # Post metadata (category / pin / cover)
    op.add_column("posts", sa.Column("category", sa.String(length=64), nullable=True))
    op.add_column(
        "posts",
        sa.Column(
            "pinned",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )
    op.add_column("posts", sa.Column("cover_image", sa.String(length=512), nullable=True))

    op.create_index("ix_posts_category", "posts", ["category"])
    op.create_index("ix_posts_pinned", "posts", ["pinned"])


def downgrade() -> None:
    op.drop_index("ix_posts_pinned", table_name="posts")
    op.drop_index("ix_posts_category", table_name="posts")

    op.drop_column("posts", "cover_image")
    op.drop_column("posts", "pinned")
    op.drop_column("posts", "category")

    op.drop_column("members", "industry")
    op.drop_column("members", "addr_company")
    op.drop_column("members", "addr_personal")
    op.drop_column("members", "company_phone")
    op.drop_column("members", "job_title")
    op.drop_column("members", "department")
    op.drop_column("members", "company")

