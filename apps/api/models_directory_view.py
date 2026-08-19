from __future__ import annotations

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.sql import func

from .models import Base


class DirectoryViewRequest(Base):
    """동문 수첩 열람 요청. 수락 시 요청자에게만 상세가 열린다."""

    __tablename__ = "directory_view_requests"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'accepted', 'declined', 'revoked')",
            name="ck_directory_view_requests_status",
        ),
        CheckConstraint(
            "requester_id <> target_id",
            name="ck_directory_view_requests_not_self",
        ),
        UniqueConstraint(
            "requester_id",
            "target_id",
            name="uq_directory_view_requests_pair",
        ),
        Index(
            "ix_directory_view_requests_target_status",
            "target_id",
            "status",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    requester_id = Column(
        Integer,
        ForeignKey("members.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    target_id = Column(
        Integer,
        ForeignKey("members.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status = Column(
        String(16),
        nullable=False,
        default="pending",
        server_default="pending",
    )
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    decided_at = Column(DateTime(timezone=True), nullable=True)
