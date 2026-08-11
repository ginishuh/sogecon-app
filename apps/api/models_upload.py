from __future__ import annotations

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
)
from sqlalchemy.sql import func

from .models import Base


class UploadAsset(Base):
    """업로드 자산 metadata — quota authority."""

    __tablename__ = "upload_assets"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('image', 'avatar')",
            name="ck_upload_assets_kind",
        ),
        Index("ix_upload_assets_owner_kind", "owner_member_id", "kind"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_member_id = Column(
        Integer,
        ForeignKey("members.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kind = Column(String(16), nullable=False)
    path = Column(String(512), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
