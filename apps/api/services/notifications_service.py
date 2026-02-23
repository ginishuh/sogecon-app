from __future__ import annotations

import asyncio
import json
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Protocol, cast

from pywebpush import WebPushException, webpush
from requests.exceptions import RequestException
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..crypto_utils import decrypt_str
from ..models import PushSubscription
from ..repositories import notifications as repo
from ..repositories import send_logs
from ..repositories.notifications import SubscriptionData


class PushProvider(Protocol):
    def send(
        self, sub: PushSubscription, payload: dict[str, Any]
    ) -> tuple[bool, int | None]:
        """동기 발송 (테스트/단건용)."""
        ...

    async def send_async(
        self, sub: PushSubscription, payload: dict[str, Any]
    ) -> tuple[bool, int | None]:
        """비동기 발송 (배치/스케줄러용) — 스레드풀에서 실행."""
        ...


class PyWebPushProvider:
    def __init__(self) -> None:
        self._webpush: Callable[..., Any] = webpush
        self._settings = get_settings()

    def send(
        self, sub: PushSubscription, payload: dict[str, Any]
    ) -> tuple[bool, int | None]:
        endpoint = decrypt_str(cast(str, sub.endpoint))
        p256dh = decrypt_str(cast(str, sub.p256dh))
        auth = decrypt_str(cast(str, sub.auth))
        subscription_info = {
            "endpoint": endpoint,
            "keys": {"p256dh": p256dh, "auth": auth},
        }
        vapid = {
            "vapid_private_key": self._settings.vapid_private_key,
            "vapid_claims": {"sub": self._settings.vapid_subject},
        }
        try:
            # Basic configuration validation to avoid raising on obvious misconfig
            if not vapid["vapid_private_key"]:
                raise ValueError("vapid_private_key missing")
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
        except (ValueError, TypeError, RuntimeError, RequestException):
            # Treat config/transport failures as send failures so caller can log
            return (False, None)

    async def send_async(
        self, sub: PushSubscription, payload: dict[str, Any]
    ) -> tuple[bool, int | None]:
        """비동기 발송 — 스레드풀에서 동기 send() 실행."""
        return await asyncio.to_thread(self.send, sub, payload)


@dataclass
class SendResult:
    accepted: int
    failed: int


async def save_subscription(db: AsyncSession, data: SubscriptionData) -> None:
    await repo.upsert_subscription(db, data)


async def delete_subscription(db: AsyncSession, *, endpoint: str) -> None:
    await repo.delete_subscription(db, endpoint=endpoint)


async def send_to_all(
    db: AsyncSession,
    provider: PushProvider,
    *,
    title: str,
    body: str,
    url: str | None = None,
) -> SendResult:
    subs = await repo.list_active_subscriptions(db)
    accepted = 0
    failed = 0
    for sub in subs:
        endpoint_plain = decrypt_str(cast(str, sub.endpoint))
        ok, status = await provider.send_async(
            sub, {"title": title, "body": body, **({"url": url} if url else {})}
        )
        if ok:
            accepted += 1
        else:
            failed += 1
            if status in (404, 410):
                await repo.remove_by_endpoint(db, endpoint=endpoint_plain)
        # 발송 로그(민감정보 해시 보관)
        await send_logs.create_log(
            db, endpoint=endpoint_plain, ok=ok, status_code=status
        )
    return SendResult(accepted=accepted, failed=failed)
