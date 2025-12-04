"""APScheduler 기반 예약 알림 스케줄러.

주의사항 (다중 워커 환경):
- uvicorn --workers N 으로 다중 워커 실행 시, 각 워커마다 스케줄러가 시작됨
- 중복 발송 방지를 위해:
  1. SCHEDULER_ENABLED=false (기본값)로 설정하고, 단일 워커/프로세스에서만 true로 활성화
  2. 또는 단일 워커(--workers 1)로 실행
  3. 또는 스케줄러를 별도 프로세스로 분리 (권장)
- ON CONFLICT DO NOTHING으로 동시 삽입은 방지되나, 불필요한 중복 작업이 발생할 수 있음
"""

from __future__ import annotations

import logging
import os
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
    """스케줄러 시작.

    다중 워커 환경에서는 단일 워커에서만 SCHEDULER_ENABLED=true로 설정해야 함.
    """
    settings = get_settings()

    # 스케줄러 비활성화 옵션 확인 (기본: 비활성화)
    if not getattr(settings, "scheduler_enabled", False):
        logger.info("스케줄러 비활성화됨 (SCHEDULER_ENABLED=false 또는 미설정)")
        return

    # 다중 워커 경고 (uvicorn의 WEB_CONCURRENCY 확인)
    workers = os.environ.get("WEB_CONCURRENCY")
    if workers and int(workers) > 1:
        logger.warning(
            f"다중 워커 환경에서 스케줄러 실행 감지 (workers={workers}). "
            "중복 작업 방지를 위해 단일 워커에서만 SCHEDULER_ENABLED=true 설정 권장."
        )

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
