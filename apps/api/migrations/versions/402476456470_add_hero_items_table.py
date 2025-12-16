"""add_hero_items_table

Revision ID: 402476456470
Revises: c1b9a4f8d2ab
Create Date: 2025-12-15 10:32:38.360470

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '402476456470'
down_revision = 'c1b9a4f8d2ab'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'hero_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('target_type', sa.String(length=16), nullable=False),
        sa.Column('target_id', sa.Integer(), nullable=False),
        sa.Column('enabled', sa.Boolean(), server_default='1', nullable=False),
        sa.Column('pinned', sa.Boolean(), server_default='0', nullable=False),
        sa.Column('title_override', sa.String(length=255), nullable=True),
        sa.Column('description_override', sa.Text(), nullable=True),
        sa.Column('image_override', sa.String(length=512), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_hero_items_enabled'), 'hero_items', ['enabled'], unique=False)
    op.create_index(op.f('ix_hero_items_pinned'), 'hero_items', ['pinned'], unique=False)
    op.create_index(op.f('ix_hero_items_created_at'), 'hero_items', ['created_at'], unique=False)
    op.create_index(op.f('ix_hero_items_target_id'), 'hero_items', ['target_id'], unique=False)
    op.create_index(op.f('ix_hero_items_target_type'), 'hero_items', ['target_type'], unique=False)
    op.create_index(op.f('ix_hero_items_updated_at'), 'hero_items', ['updated_at'], unique=False)
    op.create_index(
        'ix_hero_items_pinned_updated',
        'hero_items',
        ['pinned', 'updated_at'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_hero_items_pinned_updated', table_name='hero_items')
    op.drop_index(op.f('ix_hero_items_updated_at'), table_name='hero_items')
    op.drop_index(op.f('ix_hero_items_target_type'), table_name='hero_items')
    op.drop_index(op.f('ix_hero_items_target_id'), table_name='hero_items')
    op.drop_index(op.f('ix_hero_items_created_at'), table_name='hero_items')
    op.drop_index(op.f('ix_hero_items_pinned'), table_name='hero_items')
    op.drop_index(op.f('ix_hero_items_enabled'), table_name='hero_items')
    op.drop_table('hero_items')
