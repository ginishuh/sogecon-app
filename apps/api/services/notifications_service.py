from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Protocol, cast

from pywebpush import WebPushException, webpush
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import PushSubscription
from ..repositories import notifications as repo
from ..repositories.notifications import SubscriptionData


class PushProvider(Protocol):
    def send(
        self, sub: PushSubscription, payload: dict[str, Any]
    ) -> tuple[bool, int | None]:
        ...


class PyWebPushProvider:
    def __init__(self) -> None:
        self._webpush: Callable[..., Any] = webpush
        self._settings = get_settings()

    def send(
        self, sub: PushSubscription, payload: dict[str, Any]
    ) -> tuple[bool, int | None]:
        subscription_info = {
            "endpoint": sub.endpoint,
            "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
        }
        vapid = {
            "vapid_private_key": self._settings.vapid_private_key,
            "vapid_claims": {"sub": self._settings.vapid_subject},
        }
        try:
            resp = self._webpush(
                subscription_info=subscription_info,
                data=json.dumps(payload),
                **vapid,
            )
            status = getattr(resp, "status_code", None)
            return (True, int(status) if status is not None else None)
        except WebPushException as exc:
            status = getattr(getattr(exc, "response", None), "status_code", None)
            return (False, int(status) if status is not None else None)


@dataclass
class SendResult:
    accepted: int
    failed: int


def save_subscription(db: Session, data: SubscriptionData) -> None:
    repo.upsert_subscription(db, data)


def delete_subscription(db: Session, *, endpoint: str) -> None:
    repo.delete_subscription(db, endpoint=endpoint)


def send_test_to_all(
    db: Session,
    provider: PushProvider,
    *,
    title: str,
    body: str,
    url: str | None = None,
) -> SendResult:
    subs = repo.list_active_subscriptions(db)
    accepted = 0
    failed = 0
    for sub in subs:
        ok, status = provider.send(
            sub, {"title": title, "body": body, **({"url": url} if url else {})}
        )
        if ok:
            accepted += 1
        else:
            failed += 1
            if status in (404, 410):
                repo.remove_by_endpoint(db, endpoint=cast(str, sub.endpoint))
    return SendResult(accepted=accepted, failed=failed)
