from __future__ import annotations

from collections.abc import Callable
from datetime import datetime
from typing import Annotated, Protocol, cast

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, HttpUrl
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from apps.api.config import get_settings
from apps.api.db import get_db
from apps.api.repositories import notifications as subs_repo
from apps.api.repositories import send_logs as logs_repo
from apps.api.routers.auth import CurrentAdmin, require_admin
from apps.api.services import notifications_service as notif_svc

router = APIRouter(prefix="/notifications", tags=["notifications"])
limiter_admin = Limiter(key_func=get_remote_address)


def get_push_provider() -> notif_svc.PushProvider:
    # 기본 구현: VAPID 기반 pywebpush.
    _ = get_settings()  # 키 로딩 트리거
    return notif_svc.PyWebPushProvider()


class SubscriptionPayload(BaseModel):
    endpoint: HttpUrl
    p256dh: str
    auth: str
    ua: str | None = None
    member_id: int | None = None


@router.post("/subscriptions", status_code=204)
def save_subscription(
    payload: SubscriptionPayload,
    db: Session = Depends(get_db),
    _admin: CurrentAdmin = Depends(require_admin),
) -> None:
    """Web Push 구독 저장(idempotent). 동일 endpoint는 갱신 처리."""
    notif_svc.save_subscription(
        db,
        {
            "endpoint": str(payload.endpoint),
            "p256dh": payload.p256dh,
            "auth": payload.auth,
            "ua": payload.ua,
            "member_id": payload.member_id,
        },
    )


class UnsubscribePayload(BaseModel):
    endpoint: HttpUrl


@router.delete("/subscriptions", status_code=204)
def delete_subscription(
    payload: UnsubscribePayload,
    db: Session = Depends(get_db),
    _admin: CurrentAdmin = Depends(require_admin),
) -> None:
    notif_svc.delete_subscription(db, endpoint=str(payload.endpoint))


class TestPushPayload(BaseModel):
    title: str = "테스트 알림"
    body: str = "웹 푸시 경로 연결 확인"
    url: str | None = None


@router.post("/admin/notifications/test", status_code=202)
def send_test_push(
    _payload: TestPushPayload,
    _admin: Annotated[CurrentAdmin, Depends(require_admin)],
    request: Request,
    db: Session = Depends(get_db),
    provider: notif_svc.PushProvider = Depends(get_push_provider),
) -> dict[str, int]:
    # 레이트리밋(1/min/IP) — 테스트클라이언트는 면제
    if not (request.client and request.client.host == "testclient"):
        def _consume(_req: Request) -> None:
            return None

        class _LimiterProto(Protocol):
            # pragma: no cover
            def limit(
                self, limit_value: str
            ) -> Callable[[Callable[[Request], None]], Callable[[Request], None]]:
                ...
        limiter_typed: _LimiterProto = cast(_LimiterProto, limiter_admin)
        checker = limiter_typed.limit("1/minute")
        checker(_consume)(request)

    result = notif_svc.send_test_to_all(
        db, provider, title=_payload.title, body=_payload.body, url=_payload.url
    )
    return {"accepted": result.accepted, "failed": result.failed}


class SendLogRead(BaseModel):
    created_at: str
    ok: bool
    status_code: int | None
    endpoint_tail: str | None


@router.get("/admin/notifications/logs")
def get_send_logs(
    _admin: Annotated[CurrentAdmin, Depends(require_admin)],
    limit: int = 50,
    db: Session = Depends(get_db),
) -> list[SendLogRead]:
    rows = logs_repo.list_recent(db, limit=min(max(limit, 1), 200))
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


@router.get("/admin/notifications/stats")
def get_stats(
    _admin: Annotated[CurrentAdmin, Depends(require_admin)],
    db: Session = Depends(get_db),
) -> NotificationStats:
    subs = subs_repo.list_active_subscriptions(db)
    logs = logs_repo.list_recent(db, limit=200)
    accepted = sum(1 for r in logs if bool(r.ok))
    failed = sum(1 for r in logs if not bool(r.ok))
    return NotificationStats(
        active_subscriptions=len(subs), recent_accepted=accepted, recent_failed=failed
    )
