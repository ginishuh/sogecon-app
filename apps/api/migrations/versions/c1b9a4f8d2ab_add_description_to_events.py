"""add_description_to_events

Revision ID: c1b9a4f8d2ab
Revises: 9783a0dfd41c
Create Date: 2025-12-12 11:45:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c1b9a4f8d2ab'
down_revision = '9783a0dfd41c'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('events', sa.Column('description', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('events', 'description')

