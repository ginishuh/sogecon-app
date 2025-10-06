"""Initial tables

Revision ID: 0001_initial
Revises: 
Create Date: 2025-09-28 00:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


visibility_enum = postgresql.ENUM(
    "all", "cohort", "private", name="visibility", create_type=False
)
rsvp_status_enum = postgresql.ENUM(
    "going", "waitlist", "cancel", name="rsvp_status", create_type=False
)


def upgrade() -> None:
    # Create enum types idempotently (avoid duplicate create within same txn)
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'visibility') THEN
                CREATE TYPE visibility AS ENUM ('all','cohort','private');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rsvp_status') THEN
                CREATE TYPE rsvp_status AS ENUM ('going','waitlist','cancel');
            END IF;
        END$$;
        """
    )

    op.create_table(
        "members",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("cohort", sa.Integer(), nullable=False),
        sa.Column("major", sa.String(length=255), nullable=True),
        sa.Column("roles", sa.String(length=255), nullable=False),
        sa.Column("visibility", visibility_enum, nullable=False),
    )
    op.create_index(op.f("ix_members_email"), "members", ["email"], unique=True)

    op.create_table(
        "posts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "author_id",
            sa.Integer(),
            sa.ForeignKey("members.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(op.f("ix_posts_author_id"), "posts", ["author_id"], unique=False)
    op.create_index("ix_posts_published_at", "posts", ["published_at"], unique=False)

    op.create_table(
        "events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("location", sa.String(length=255), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False),
    )
    op.create_index("ix_events_starts_at", "events", ["starts_at"], unique=False)

    op.create_table(
        "rsvps",
        sa.Column(
            "member_id",
            sa.Integer(),
            sa.ForeignKey("members.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "event_id",
            sa.Integer(),
            sa.ForeignKey("events.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("status", rsvp_status_enum, nullable=False),
    )


def downgrade() -> None:
    op.drop_table("rsvps")
    op.drop_index("ix_events_starts_at", table_name="events")
    op.drop_table("events")
    op.drop_index("ix_posts_published_at", table_name="posts")
    op.drop_index(op.f("ix_posts_author_id"), table_name="posts")
    op.drop_table("posts")
    op.drop_index(op.f("ix_members_email"), table_name="members")
    op.drop_table("members")

    rsvp_status_enum.drop(op.get_bind(), checkfirst=True)
    visibility_enum.drop(op.get_bind(), checkfirst=True)
