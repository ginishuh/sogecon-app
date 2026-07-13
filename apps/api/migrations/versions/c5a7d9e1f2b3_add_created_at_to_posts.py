"""add created_at to posts

Revision ID: c5a7d9e1f2b3
Revises: f4e9c1a2b3d4
Create Date: 2026-07-13 14:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c5a7d9e1f2b3"
down_revision: str | None = "f4e9c1a2b3d4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 과거 게시글의 실제 작성 시각은 복원할 근거가 없으므로 null로 보존한다.
    # 컬럼 추가 뒤 기본값을 설정해 신규 게시글부터 정확한 시각을 기록한다.
    op.add_column(
        "posts",
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.alter_column("posts", "created_at", server_default=sa.func.now())
    op.create_index("ix_posts_created_at", "posts", ["created_at"])
    op.execute(
        sa.text(
            "CREATE INDEX ix_posts_pinned_effective_date "
            "ON posts (pinned DESC, "
            "COALESCE(published_at, created_at) DESC NULLS LAST, id DESC)"
        )
    )


def downgrade() -> None:
    op.drop_index("ix_posts_pinned_effective_date", table_name="posts")
    op.drop_index("ix_posts_created_at", table_name="posts")
    op.drop_column("posts", "created_at")
