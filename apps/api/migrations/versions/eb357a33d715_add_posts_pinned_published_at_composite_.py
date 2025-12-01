"""add posts pinned published_at composite index

Revision ID: eb357a33d715
Revises: a1b2c3d4e5f6
Create Date: 2025-12-01 21:21:40.478998

Posts 복합 인덱스: list_posts 쿼리 최적화
- order_by(pinned DESC, published_at DESC) 패턴에 매칭
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'eb357a33d715'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # CONCURRENTLY로 무중단 인덱스 생성
    with op.get_context().autocommit_block():
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_posts_pinned_published "
            "ON posts (pinned DESC, published_at DESC)"
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_posts_pinned_published")
