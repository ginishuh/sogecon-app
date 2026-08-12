from __future__ import annotations

import asyncio
import json
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol, cast

from pywebpush import WebPushException, webpush
from requests.exceptions import RequestException
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..crypto_utils import CryptoError, decrypt_str, is_push_encryption_effective
from ..errors import ApiError
from ..models import PushSubscription
from ..repositories import notifications as repo
from ..repositories import send_logs
from ..repositories.notifications import SubscriptionData, SubscriptionOwnershipError
from ..repositories.send_logs import SendLogItem


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
        try:
            endpoint = decrypt_str(cast(str, sub.endpoint))
            p256dh = decrypt_str(cast(str, sub.p256dh))
            auth = decrypt_str(cast(str, sub.auth))
        except CryptoError:
            # 손상·키불일치 구독은 평문 전송 없이 실패 처리
            return (False, None)
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


def _ownership_error() -> ApiError:
    return ApiError(
        code="subscription_forbidden",
        detail="subscription_forbidden",
        status=403,
    )


async def save_subscription(
    db: AsyncSession, data: SubscriptionData, *, actor_member_id: int
) -> None:
    try:
        await repo.upsert_subscription(db, data, actor_member_id=actor_member_id)
    except SubscriptionOwnershipError as exc:
        raise _ownership_error() from exc


async def delete_subscription(
    db: AsyncSession, *, endpoint: str, actor_member_id: int
) -> None:
    try:
        await repo.delete_subscription(
            db, endpoint=endpoint, actor_member_id=actor_member_id
        )
    except SubscriptionOwnershipError as exc:
        raise _ownership_error() from exc


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
    log_items: list[SendLogItem] = []
    expired_hashes: list[str] = []
    payload = {"title": title, "body": body, **({"url": url} if url else {})}
    for sub in subs:
        try:
            endpoint_plain = decrypt_str(cast(str, sub.endpoint))
        except CryptoError:
            failed += 1
            log_items.append(
                SendLogItem(
                    ok=False,
                    status_code=None,
                    stored_endpoint_hash=cast(str, sub.endpoint_hash),
                )
            )
            continue

        ok, status = await provider.send_async(sub, payload)
        if ok:
            accepted += 1
        else:
            failed += 1
            if status in (404, 410):
                expired_hashes.append(repo.hash_endpoint(endpoint_plain))
        log_items.append(
            SendLogItem(endpoint=endpoint_plain, ok=ok, status_code=status)
        )
    # DB: 발송 로그·만료 구독 정리는 bounded batch commit
    await send_logs.create_logs_batch(db, log_items)
    await repo.remove_by_endpoint_hashes(db, expired_hashes)
    return SendResult(accepted=accepted, failed=failed)


@dataclass
class SendLogReadData:
    created_at: str
    ok: bool
    status_code: int | None
    endpoint_tail: str | None


@dataclass
class NotificationStatsData:
    active_subscriptions: int
    recent_accepted: int
    recent_failed: int
    encryption_enabled: bool
    range_label: str
    failed_404: int | None
    failed_410: int | None
    failed_other: int | None


async def list_recent_send_logs(
    db: AsyncSession,
    *,
    limit: int,
) -> list[SendLogReadData]:
    rows = await send_logs.list_recent(db, limit=limit)
    out: list[SendLogReadData] = []
    for row in rows:
        created_dt = cast(datetime | None, row.created_at)
        out.append(
            SendLogReadData(
                created_at=created_dt.isoformat() if created_dt else "",
                ok=bool(cast(int, row.ok)),
                status_code=cast(int | None, row.status_code),
                endpoint_tail=cast(str | None, row.endpoint_tail),
            )
        )
    return out


async def get_notification_stats(
    db: AsyncSession,
    *,
    range_label: str,
    cutoff: datetime,
) -> NotificationStatsData:
    active = await repo.count_active_subscriptions(db)
    agg = await send_logs.aggregate_since(db, cutoff=cutoff)
    settings = get_settings()
    return NotificationStatsData(
        active_subscriptions=active,
        recent_accepted=agg.accepted,
        recent_failed=agg.failed,
        encryption_enabled=is_push_encryption_effective(settings),
        range_label=range_label,
        failed_404=agg.failed_404,
        failed_410=agg.failed_410,
        failed_other=agg.failed_other,
    )


async def prune_notification_logs(db: AsyncSession, *, days: int) -> int:
    return await send_logs.prune_older_than_days(db, days=days)
