"""add_images_jsonb_to_posts

Revision ID: 9783a0dfd41c
Revises: 852f8707bed6
Create Date: 2025-12-04 14:23:06.444427

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '9783a0dfd41c'
down_revision = '852f8707bed6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'posts',
        sa.Column('images', postgresql.JSONB(astext_type=sa.Text()), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('posts', 'images')