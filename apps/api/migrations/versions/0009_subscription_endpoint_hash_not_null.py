"""make endpoint_hash NOT NULL and ensure backfill

Revision ID: 0009_subscription_endpoint_hash_not_null
Revises: 0008_subscription_endpoint_hash
Create Date: 2025-10-07
"""
from __future__ import annotations

import hashlib

import sqlalchemy as sa
from alembic import op

revision = "0009_subscription_endpoint_hash_not_null"
down_revision = "0008_subscription_endpoint_hash"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    meta = sa.MetaData()
    t = sa.Table("push_subscriptions", meta, autoload_with=bind)
    # Backfill any NULL hashes
    rows = bind.execute(sa.select(t.c.id, t.c.endpoint, t.c.endpoint_hash)).fetchall()
    for rid, endpoint, h in rows:
        if h is None and endpoint is not None:
            hh = hashlib.sha256(endpoint.encode()).hexdigest()
            bind.execute(sa.update(t).where(t.c.id == rid).values(endpoint_hash=hh))
    # Enforce NOT NULL
    op.alter_column(
        "push_subscriptions",
        "endpoint_hash",
        existing_type=sa.String(length=64),
        nullable=False,
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "push_subscriptions",
        "endpoint_hash",
        existing_type=sa.String(length=64),
        nullable=True,
        existing_nullable=False,
    )

