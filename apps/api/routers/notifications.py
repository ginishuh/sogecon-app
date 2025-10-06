from __future__ import annotations

from typing import Annotated, Any, cast

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, HttpUrl
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..services import notifications_service as notif_svc
from .auth import CurrentAdmin, require_admin

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
    payload: SubscriptionPayload, db: Session = Depends(get_db)
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
    payload: UnsubscribePayload, db: Session = Depends(get_db)
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

        checker = cast(Any, limiter_admin).limit("1/minute")
        checker(_consume)(request)

    result = notif_svc.send_test_to_all(
        db, provider, title=_payload.title, body=_payload.body, url=_payload.url
    )
    return {"accepted": result.accepted, "failed": result.failed}
