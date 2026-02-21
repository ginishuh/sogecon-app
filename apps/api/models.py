from __future__ import annotations

import enum
from typing import cast

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
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
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'active', 'suspended', 'rejected')",
            name="ck_members_status",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String(20), nullable=False, unique=True, index=True)
    email = Column(String(255), nullable=True, unique=True, index=True)
    name = Column(String(255), nullable=False)
    cohort = Column(Integer, nullable=False)
    major = Column(String(255), nullable=True)
    roles = Column(String(255), nullable=False, default="member")
    status = Column(
        String(16),
        nullable=False,
        default="active",
        server_default="active",
        index=True,
    )
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
    phone = Column(String(64), nullable=True, unique=True, index=True)
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
    images = Column(JSONB, nullable=True, default=list)  # 추가 이미지 URL 배열
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
    description = Column(Text, nullable=True)
    starts_at = Column(DateTime(timezone=True), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=False)
    location = Column(String(255), nullable=False)
    capacity = Column(Integer, nullable=False)

    rsvps = relationship("RSVP", back_populates="event", cascade="all, delete-orphan")


Index("ix_events_starts_at", Event.starts_at)


class HeroItem(Base):
    """홈 히어로 배너 슬롯.

    - B안: 히어로는 별도 '게시글'이 아니라, 행사/게시글을 추천 노출하는 슬롯이다.
    - target_type/target_id로 실제 대상(행사/게시글)을 참조한다.
      (다형 FK는 DB 레벨로 강제하기 어렵기 때문에 서비스 계층에서 검증한다.)
    """

    __tablename__ = "hero_items"

    id = Column(Integer, primary_key=True)
    target_type = Column(String(16), nullable=False, index=True)  # 'post' | 'event'
    target_id = Column(Integer, nullable=False, index=True)

    enabled = Column(
        Boolean, nullable=False, default=True, server_default="1", index=True
    )
    pinned = Column(
        Boolean, nullable=False, default=False, server_default="0", index=True
    )

    title_override = Column(String(255), nullable=True)
    description_override = Column(Text, nullable=True)
    image_override = Column(String(512), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        server_onupdate=func.now(),
        onupdate=func.now(),
    )


Index("ix_hero_items_updated_at", HeroItem.updated_at)
Index(
    "ix_hero_items_pinned_updated",
    HeroItem.pinned,
    HeroItem.updated_at,
)


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


class SignupRequest(Base):
    __tablename__ = "signup_requests"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'approved', 'rejected', 'activated')",
            name="ck_signup_requests_status",
        ),
        Index("ix_signup_requests_status_requested_at", "status", "requested_at"),
        Index(
            "uq_signup_requests_student_id_pending",
            "student_id",
            unique=True,
            postgresql_where=text("status = 'pending'"),
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String(20), nullable=False, index=True)
    email = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    cohort = Column(Integer, nullable=False)
    major = Column(String(255), nullable=True)
    phone = Column(String(64), nullable=True)
    note = Column(Text, nullable=True)
    status = Column(
        String(16),
        nullable=False,
        default="pending",
        server_default="pending",
        index=True,
    )
    requested_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    decided_at = Column(DateTime(timezone=True), nullable=True)
    activated_at = Column(DateTime(timezone=True), nullable=True)
    decided_by_student_id = Column(String(20), nullable=True)
    reject_reason = Column(Text, nullable=True)


# Web Push 구독 정보(민감 데이터: endpoint/key는 운영에서 암호화 저장 고려)
class ProfileChangeRequest(Base):
    """회원 프로필 변경 요청 (이름/기수 — 관리자 승인 필요)."""

    __tablename__ = "profile_change_requests"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'approved', 'rejected')",
            name="ck_profile_change_requests_status",
        ),
        CheckConstraint(
            "field_name IN ('name', 'cohort')",
            name="ck_profile_change_requests_field_name",
        ),
        Index(
            "ix_profile_change_requests_status_requested_at",
            "status",
            "requested_at",
        ),
        Index(
            "uq_profile_change_requests_member_field_pending",
            "member_id",
            "field_name",
            unique=True,
            postgresql_where=text("status = 'pending'"),
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    member_id = Column(
        Integer,
        ForeignKey("members.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    field_name = Column(String(16), nullable=False)  # 'name' | 'cohort'
    old_value = Column(String(255), nullable=False)
    new_value = Column(String(255), nullable=False)
    status = Column(
        String(16),
        nullable=False,
        default="pending",
        server_default="pending",
        index=True,
    )
    requested_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    decided_at = Column(DateTime(timezone=True), nullable=True)
    decided_by_student_id = Column(String(20), nullable=True)
    reject_reason = Column(Text, nullable=True)


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


class ScheduledNotificationLog(Base):
    """예약 알림 발송 로그 (중복 발송 방지 및 추적용)."""

    __tablename__ = "scheduled_notification_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_id = Column(
        Integer,
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    d_type = Column(String(8), nullable=False)  # 'd-3' | 'd-1'
    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    accepted_count = Column(Integer, nullable=False, default=0)
    failed_count = Column(Integer, nullable=False, default=0)
    status = Column(
        String(16), nullable=False, default="pending"
    )  # pending | in_progress | completed | failed
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        Index(
            "ix_scheduled_notification_event_dtype",
            "event_id",
            "d_type",
            unique=True,
        ),
    )


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
    
