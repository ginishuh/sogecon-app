"""add posts pinned published_at composite index

Revision ID: eb357a33d715
Revises: a1b2c3d4e5f6
Create Date: 2025-12-01 21:21:40.478998

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'eb357a33d715'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        'ix_posts_pinned_published',
        'posts',
        [sa.literal_column('pinned DESC'), sa.literal_column('published_at DESC')],
        unique=False
    )


def downgrade() -> None:
    op.drop_index('ix_posts_pinned_published', table_name='posts')