"""NotificationPreference 리포지토리 — 토픽별 알림 선호도 조회."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models


async def get_opted_out_member_ids(
    db: AsyncSession,
    *,
    channel: str = "webpush",
    topic: str,
) -> set[int]:
    """특정 토픽 알림을 명시적으로 비활성화한 회원 ID 목록 반환."""
    stmt = select(models.NotificationPreference.member_id).where(
        models.NotificationPreference.channel == channel,
        models.NotificationPreference.topic == topic,
        models.NotificationPreference.enabled.is_(False),
    )
    result = await db.execute(stmt)
    return set(result.scalars().all())


async def get_opted_in_member_ids(
    db: AsyncSession,
    *,
    channel: str = "webpush",
    topic: str,
) -> set[int]:
    """특정 토픽 알림을 활성화한 회원 ID 목록 반환."""
    stmt = select(models.NotificationPreference.member_id).where(
        models.NotificationPreference.channel == channel,
        models.NotificationPreference.topic == topic,
        models.NotificationPreference.enabled.is_(True),
    )
    result = await db.execute(stmt)
    return set(result.scalars().all())
