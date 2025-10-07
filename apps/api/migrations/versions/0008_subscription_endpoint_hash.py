"""add endpoint_hash to push_subscriptions

Revision ID: 0008_subscription_endpoint_hash
Revises: 0007_member_auth
Create Date: 2025-10-07
"""
from __future__ import annotations

import hashlib

import sqlalchemy as sa
from alembic import op

revision = "0008_subscription_endpoint_hash"
down_revision = "0007_member_auth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "push_subscriptions",
        sa.Column("endpoint_hash", sa.String(length=64), nullable=True),
    )
    op.create_index(
        "ix_push_subscriptions_endpoint_hash",
        "push_subscriptions",
        ["endpoint_hash"],
        unique=True,
    )
    # backfill hashes
    bind = op.get_bind()
    meta = sa.MetaData()
    t = sa.Table("push_subscriptions", meta, autoload_with=bind)
    rows = bind.execute(sa.select(t.c.id, t.c.endpoint)).fetchall()
    for rid, endpoint in rows:
        if endpoint is None:
            continue
        h = hashlib.sha256(endpoint.encode()).hexdigest()
        bind.execute(
            sa.update(t).where(t.c.id == rid).values(endpoint_hash=h)
        )


def downgrade() -> None:
    op.drop_index(
        "ix_push_subscriptions_endpoint_hash", table_name="push_subscriptions"
    )
    op.drop_column("push_subscriptions", "endpoint_hash")
