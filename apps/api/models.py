from __future__ import annotations

import enum
from typing import cast

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


def _enum_values(enum_cls: type[enum.Enum]) -> list[str]:
    """SQLAlchemy Enum.values_callable용 헬퍼.

    Pyright(strict)에서 람다의 매개변수/반환 타입 추론 경고를 피하기 위해
    명시적 시그니처를 둡니다. Enum.value는 Unknown으로 추론되므로 str로 cast합니다.
    """
    return [cast(str, member.value) for member in enum_cls]


class Member(Base):
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String(20), nullable=False, unique=True, index=True)
    email = Column(String(255), nullable=True, unique=True, index=True)
    name = Column(String(255), nullable=False)
    cohort = Column(Integer, nullable=False)
    major = Column(String(255), nullable=True)
    roles = Column(String(255), nullable=False, default="member")
    # Enum 라벨을 DB에 소문자(value)로 저장하도록 values_callable 지정
    visibility = Column(
        Enum(
            Visibility,
            name="visibility",
            values_callable=_enum_values,
        ),
        nullable=False,
        default=Visibility.ALL,
    )
    # B v1 확장: 표시용 생일(양/음) + 연락처(간단 문자열)
    birth_date = Column(String(10), nullable=True)  # 'YYYY-MM-DD'
    birth_lunar = Column(Boolean, nullable=True)
    phone = Column(String(64), nullable=True)
    # B v1 확장 필드(표시/연락/소속/주소/업종)
    company = Column(String(255), nullable=True)
    department = Column(String(255), nullable=True)
    job_title = Column(String(255), nullable=True)
    company_phone = Column(String(64), nullable=True)
    addr_personal = Column(String(255), nullable=True)
    addr_company = Column(String(255), nullable=True)
    industry = Column(String(255), nullable=True)
    avatar_path = Column(String(255), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        server_onupdate=func.now(),
        onupdate=func.now(),
    )

    posts = relationship("Post", back_populates="author", cascade="all, delete-orphan")
    rsvps = relationship("RSVP", back_populates="member", cascade="all, delete-orphan")


Index("ix_members_updated_at", Member.updated_at)
Index("ix_members_cohort_name", Member.cohort, Member.name)


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
    category = Column(String(64), nullable=True, index=True)  # 'notice' | 'news' | ...
    pinned = Column(
        Boolean, nullable=False, default=False, server_default="0", index=True
    )
    cover_image = Column(String(512), nullable=True)
    view_count = Column(
        Integer, nullable=False, default=0, server_default="0", index=False
    )

    author = relationship("Member", back_populates="posts")
    comments = relationship(
        "Comment", back_populates="post", cascade="all, delete-orphan"
    )


Index("ix_posts_published_at_desc", Post.published_at.desc())
# 복합 인덱스: list_posts 쿼리 최적화 (pinned DESC, published_at DESC)
Index("ix_posts_pinned_published", Post.pinned.desc(), Post.published_at.desc())


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True)
    post_id = Column(
        Integer,
        ForeignKey("posts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    author_id = Column(
        Integer,
        ForeignKey("members.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    content = Column(Text, nullable=False)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )

    post = relationship("Post", back_populates="comments")
    author = relationship("Member")


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
    # 마찬가지로 RSVP 상태도 소문자 라벨 적용
    status = Column(
        Enum(
            RSVPStatus,
            name="rsvpstatus",
            values_callable=_enum_values,
        ),
        nullable=False,
        default=RSVPStatus.GOING,
    )
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    member = relationship("Member", back_populates="rsvps")
    event = relationship("Event", back_populates="rsvps")


class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True)
    student_id = Column(String(20), nullable=False, unique=True, index=True)
    email = Column(String(255), nullable=True, unique=True, index=True)
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
    endpoint_hash = Column(String(64), unique=True, index=True, nullable=False)
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


class NotificationSendLog(Base):
    __tablename__ = "notification_send_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    ok = Column(Integer, nullable=False, default=0)  # 1=accepted, 0=failed
    status_code = Column(Integer, nullable=True)
    endpoint_hash = Column(String(64), nullable=False, index=True)
    endpoint_tail = Column(String(32), nullable=True)


class MemberAuth(Base):
    __tablename__ = "member_auth"

    id = Column(Integer, primary_key=True, autoincrement=True)
    member_id = Column(
        Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False
    )
    __table_args__ = (Index("ix_member_auth_member_id", "member_id"),)
    student_id = Column(String(20), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    
