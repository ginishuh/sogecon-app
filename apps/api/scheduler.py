"""APScheduler 기반 예약 알림 스케줄러."""

from __future__ import annotations

import logging
from datetime import timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from .config import get_settings
from .db import AsyncSessionLocal
from .services import scheduled_notifications_service as sched_svc
from .services.notifications_service import PyWebPushProvider

logger = logging.getLogger(__name__)

KST = timezone(timedelta(hours=9))

# 모듈 상태 (global 문 대신 dict 사용)
_state: dict[str, AsyncIOScheduler | None] = {"scheduler": None}


async def process_scheduled_notifications() -> None:
    """D-3/D-1 이벤트 알림 처리 (매일 09:00 KST 실행)."""
    logger.info("예약 알림 처리 시작")

    async with AsyncSessionLocal() as db:
        provider = PyWebPushProvider()
        result = await sched_svc.trigger_scheduled_notifications(db, provider)

        logger.info(
            f"예약 알림 처리 완료: total={result.total_events}, "
            f"processed={result.processed}, skipped={result.skipped}, "
            f"accepted={result.total_accepted}, failed={result.total_failed}"
        )


def start_scheduler() -> None:
    """스케줄러 시작."""
    settings = get_settings()

    # 스케줄러 비활성화 옵션 확인
    if not getattr(settings, "scheduler_enabled", True):
        logger.info("스케줄러 비활성화됨 (SCHEDULER_ENABLED=false)")
        return

    scheduler = AsyncIOScheduler(timezone=KST)

    # 매일 09:00 KST에 실행
    scheduler.add_job(
        process_scheduled_notifications,
        trigger=CronTrigger(hour=9, minute=0),
        id="scheduled_notifications",
        name="D-3/D-1 이벤트 알림 발송",
        replace_existing=True,
    )

    scheduler.start()
    _state["scheduler"] = scheduler
    logger.info("스케줄러 시작됨 (매일 09:00 KST)")


def shutdown_scheduler() -> None:
    """스케줄러 종료."""
    scheduler = _state["scheduler"]
    if scheduler is not None:
        scheduler.shutdown(wait=False)
        _state["scheduler"] = None
        logger.info("스케줄러 종료됨")
