from __future__ import annotations

import enum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func

Base = declarative_base()


class Visibility(enum.Enum):
    ALL = "all"
    COHORT = "cohort"
    PRIVATE = "private"


class RSVPStatus(enum.Enum):
    GOING = "going"
    WAITLIST = "waitlist"
    CANCEL = "cancel"


class Member(Base):
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=False)
    cohort = Column(Integer, nullable=False)
    major = Column(String(255), nullable=True)
    roles = Column(String(255), nullable=False, default="member")
    visibility = Column(Enum(Visibility), nullable=False, default=Visibility.ALL)

    posts = relationship("Post", back_populates="author", cascade="all, delete-orphan")
    rsvps = relationship("RSVP", back_populates="member", cascade="all, delete-orphan")


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True)
    author_id = Column(
        Integer,
        ForeignKey("members.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    published_at = Column(DateTime(timezone=True), nullable=True, index=True)

    author = relationship("Member", back_populates="posts")


Index("ix_posts_published_at_desc", Post.published_at.desc())


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=False)
    starts_at = Column(DateTime(timezone=True), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=False)
    location = Column(String(255), nullable=False)
    capacity = Column(Integer, nullable=False)

    rsvps = relationship("RSVP", back_populates="event", cascade="all, delete-orphan")


Index("ix_events_starts_at", Event.starts_at)


class RSVP(Base):
    __tablename__ = "rsvps"

    member_id = Column(
        Integer,
        ForeignKey("members.id", ondelete="CASCADE"),
        primary_key=True,
    )
    event_id = Column(
        Integer,
        ForeignKey("events.id", ondelete="CASCADE"),
        primary_key=True,
    )
    status = Column(Enum(RSVPStatus), nullable=False, default=RSVPStatus.GOING)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    member = relationship("Member", back_populates="rsvps")
    event = relationship("Event", back_populates="rsvps")


class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


# Web Push 구독 정보(민감 데이터: endpoint/key는 운영에서 암호화 저장 고려)
class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    member_id = Column(
        Integer,
        ForeignKey("members.id", ondelete="SET NULL"),
        nullable=True,
    )
    endpoint = Column(String(512), unique=True, index=True, nullable=False)
    p256dh = Column(String(255), nullable=False)
    auth = Column(String(255), nullable=False)
    ua = Column(String(255), nullable=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_seen_at = Column(DateTime(timezone=True), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    id = Column(Integer, primary_key=True, autoincrement=True)
    member_id = Column(
        Integer,
        ForeignKey("members.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    channel = Column(String(32), nullable=False, index=True)  # e.g., 'webpush'
    topic = Column(String(64), nullable=False)
    enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
