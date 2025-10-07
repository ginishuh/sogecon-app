"""add member profile fields (birth_date, birth_lunar, phone)

Revision ID: 0010_member_profile_fields
Revises: 0009_subscription_endpoint_hash_not_null
Create Date: 2025-10-07
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0010_member_profile_fields"
down_revision = "0009_subscription_endpoint_hash_not_null"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("members", sa.Column("birth_date", sa.String(length=10), nullable=True))
    op.add_column("members", sa.Column("birth_lunar", sa.Boolean(), nullable=True))
    op.add_column("members", sa.Column("phone", sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column("members", "phone")
    op.drop_column("members", "birth_lunar")
    op.drop_column("members", "birth_date")

