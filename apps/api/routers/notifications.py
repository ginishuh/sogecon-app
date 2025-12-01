from __future__ import annotations

from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from typing import Annotated, cast

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, HttpUrl
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.config import get_settings
from apps.api.db import get_db
from apps.api.ratelimit import consume_limit
from apps.api.repositories import notifications as subs_repo
from apps.api.repositories import send_logs as logs_repo
from apps.api.routers.auth import (
    CurrentAdmin,
    CurrentMember,
    require_admin,
    require_member,
)
from apps.api.services import notifications_service as notif_svc

router = APIRouter(prefix="/notifications", tags=["notifications"])
limiter_notifications = Limiter(key_func=get_remote_address)


def _is_test_client(request: Request) -> bool:
    return bool(request.client and request.client.host == "testclient")

# pyright/ruff 호환 UTC 타임존 (timezone.utc 대체)
UTC_TZ = timezone(timedelta(0))


def get_push_provider() -> notif_svc.PushProvider:
    # 기본 구현: VAPID 기반 pywebpush.
    _ = get_settings()  # 키 로딩 트리거
    return notif_svc.PyWebPushProvider()


class SubscriptionPayload(BaseModel):
    endpoint: HttpUrl
    p256dh: str
    auth: str
    ua: str | None = None


@router.post("/subscriptions", status_code=204)
async def save_subscription(
    payload: SubscriptionPayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _member: CurrentMember = Depends(require_member),
) -> None:
    """Web Push 구독 저장(idempotent). 동일 endpoint는 갱신 처리."""
    settings = get_settings()
    if not _is_test_client(request):
        consume_limit(
            limiter_notifications,
            request,
            settings.rate_limit_subscribe,
        )
    await notif_svc.save_subscription(
        db,
        {
            "endpoint": str(payload.endpoint),
            "p256dh": payload.p256dh,
            "auth": payload.auth,
            "ua": payload.ua,
            "member_id": None,
        },
    )


class UnsubscribePayload(BaseModel):
    endpoint: HttpUrl


@router.delete("/subscriptions", status_code=204)
async def delete_subscription(
    payload: UnsubscribePayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _member: CurrentMember = Depends(require_member),
) -> None:
    settings = get_settings()
    if not _is_test_client(request):
        consume_limit(
            limiter_notifications,
            request,
            settings.rate_limit_subscribe,
        )
    await notif_svc.delete_subscription(db, endpoint=str(payload.endpoint))


class TestPushPayload(BaseModel):
    title: str = "테스트 알림"
    body: str = "웹 푸시 경로 연결 확인"
    url: str | None = None


@router.post("/admin/notifications/test", status_code=202)
async def send_test_push(
    _payload: TestPushPayload,
    _admin: Annotated[CurrentAdmin, Depends(require_admin)],
    request: Request,
    db: AsyncSession = Depends(get_db),
    provider: notif_svc.PushProvider = Depends(get_push_provider),
) -> dict[str, int]:
    if not _is_test_client(request):
        consume_limit(
            limiter_notifications,
            request,
            get_settings().rate_limit_notify_test,
        )

    result = await notif_svc.send_test_to_all(
        db, provider, title=_payload.title, body=_payload.body, url=_payload.url
    )
    return {"accepted": result.accepted, "failed": result.failed}


class SendLogRead(BaseModel):
    created_at: str
    ok: bool
    status_code: int | None
    endpoint_tail: str | None


@router.get("/admin/notifications/logs")
async def get_send_logs(
    _admin: Annotated[CurrentAdmin, Depends(require_admin)],
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
) -> list[SendLogRead]:
    rows = await logs_repo.list_recent(db, limit=min(max(limit, 1), 200))
    out: list[SendLogRead] = []
    for r in rows:
        created_dt = cast(datetime | None, r.created_at)
        out.append(
            SendLogRead(
                created_at=created_dt.isoformat() if created_dt else "",
                ok=bool(cast(int, r.ok)),
                status_code=cast(int | None, r.status_code),
                endpoint_tail=cast(str | None, r.endpoint_tail),
            )
        )
    return out


class NotificationStats(BaseModel):
    active_subscriptions: int
    recent_accepted: int
    recent_failed: int
    encryption_enabled: bool
    range: str | None = None
    failed_404: int | None = None
    failed_410: int | None = None
    failed_other: int | None = None


@router.get("/admin/notifications/stats")
async def get_stats(
    _admin: Annotated[CurrentAdmin, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
    range: str = "7d",
) -> NotificationStats:
    # 범위 파싱: 24h | 7d | 30d (기본 7d)
    r = (range or "").lower()
    if r not in ("24h", "7d", "30d"):
        r = "7d"
    delta = (
        timedelta(hours=24)
        if r == "24h"
        else (timedelta(days=7) if r == "7d" else timedelta(days=30))
    )
    cutoff = datetime.now(UTC_TZ) - delta

    subs = await subs_repo.list_active_subscriptions(db)
    logs = await logs_repo.list_since(db, cutoff=cutoff)
    accepted = 0
    failed = 0
    f404 = 0
    f410 = 0
    for rlog in logs:
        ok_v = int(cast(int, getattr(rlog, "ok", 0)))
        sc = cast(int | None, getattr(rlog, "status_code", None))
        if ok_v != 0:
            accepted += 1
        else:
            failed += 1
            if sc == int(HTTPStatus.NOT_FOUND):
                f404 += 1
            elif sc == int(HTTPStatus.GONE):
                f410 += 1
    fother = failed - (f404 + f410)
    settings = get_settings()
    return NotificationStats(
        active_subscriptions=len(subs),
        recent_accepted=accepted,
        recent_failed=failed,
        encryption_enabled=bool(settings.push_encrypt_at_rest),
        range=r,
        failed_404=f404,
        failed_410=f410,
        failed_other=fother,
    )


class PruneLogsPayload(BaseModel):
    older_than_days: int = 30


@router.post("/admin/notifications/prune-logs")
async def prune_logs(
    payload: PruneLogsPayload,
    _admin: Annotated[CurrentAdmin, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
) -> dict[str, int | str]:
    days = max(1, int(payload.older_than_days))
    n = await logs_repo.prune_older_than_days(db, days=days)
    before = datetime.now(UTC_TZ) - timedelta(days=days)
    return {"deleted": n, "before": before.isoformat(), "older_than_days": days}
