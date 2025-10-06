from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, HttpUrl
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import PushSubscription
from .auth import CurrentAdmin, require_admin

router = APIRouter(prefix="/notifications", tags=["notifications"])


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
    """Web Push 구독 저장(idempotent).

    - 동일 endpoint는 upsert처럼 동작(값 갱신 후 204)
    - 실제 운영에서는 endpoint/key를 암호화 저장 권장
    """
    # 단순 스캐폴드: 없는 경우 생성, 있는 경우 필드 갱신
    sub = (
        db.query(PushSubscription)
        .filter(PushSubscription.endpoint == str(payload.endpoint))
        .first()
    )
    if sub is None:
        sub = PushSubscription(
            endpoint=str(payload.endpoint),
            p256dh=payload.p256dh,
            auth=payload.auth,
            ua=payload.ua,
            member_id=payload.member_id,
        )
        db.add(sub)
        db.commit()
        return
    # 갱신
    sub.p256dh = payload.p256dh
    sub.auth = payload.auth
    sub.ua = payload.ua
    if payload.member_id is not None:
        sub.member_id = payload.member_id
    db.commit()


class UnsubscribePayload(BaseModel):
    endpoint: HttpUrl


@router.delete("/subscriptions", status_code=204)
def delete_subscription(
    payload: UnsubscribePayload, db: Session = Depends(get_db)
) -> None:
    sub = (
        db.query(PushSubscription)
        .filter(PushSubscription.endpoint == str(payload.endpoint))
        .first()
    )
    if sub is None:
        return
    db.delete(sub)
    db.commit()


class TestPushPayload(BaseModel):
    title: str = "테스트 알림"
    body: str = "웹 푸시 경로 연결 확인"


@router.post("/admin/notifications/test", status_code=202)
def send_test_push(
    _payload: TestPushPayload,
    _admin: Annotated[CurrentAdmin, Depends(require_admin)],
    _db: Session = Depends(get_db),
) -> dict[str, int]:
    """관리자 전용 테스트 발송.

    - 초기 스캐폴드는 전송을 생략하고 202 + 건수 0을 반환.
    - M3 본구현에서 pywebpush를 통해 구독 대상으로 발송.
    """
    return {"accepted": 0, "failed": 0}
