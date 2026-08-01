from __future__ import annotations

import asyncio
from collections.abc import Sequence
from dataclasses import dataclass
from typing import cast

from sqlalchemy.ext.asyncio import AsyncSession

from ..crypto_utils import CryptoError, decrypt_str
from ..models import PushSubscription
from ..repositories import notifications as subs_repo
from ..repositories import scheduled_notifications as scheduled_repo
from ..repositories import send_logs
from .notifications_service import PushProvider


@dataclass(frozen=True)
class DeliveryBatchConfig:
    max_retries: int = 3
    scheduled_log_id: int | None = None


@dataclass(frozen=True)
class _DeliveryAttempt:
    ok: bool
    status_code: int | None
    uncertain: bool = False


async def _send_with_retry(
    provider: PushProvider,
    sub: PushSubscription,
    payload: dict[str, str],
    *,
    max_retries: int,
) -> _DeliveryAttempt:
    """지수 백오프로 일시적 Push 실패를 재시도한다."""
    status: int | None = None
    for attempt in range(max_retries + 1):
        ok, status = await provider.send_async(sub, payload)
        if ok:
            return _DeliveryAttempt(ok=True, status_code=status)
        if status is None:
            # 요청이 Push provider에 도달했는지 알 수 없으므로 재시도하면
            # 중복 발송이 될 수 있다.
            return _DeliveryAttempt(
                ok=False,
                status_code=None,
                uncertain=True,
            )
        if status in (400, 404, 410):
            return _DeliveryAttempt(ok=False, status_code=status)
        if attempt < max_retries:
            await asyncio.sleep((2**attempt) * 0.5)
    return _DeliveryAttempt(ok=False, status_code=status)


def _decrypt_subscription(sub: PushSubscription) -> str:
    """외부 호출 전 암호화 필드가 유효한지 확인하고 endpoint를 반환한다."""
    endpoint_plain = decrypt_str(cast(str, sub.endpoint))
    decrypt_str(cast(str, sub.p256dh))
    decrypt_str(cast(str, sub.auth))
    return endpoint_plain


async def _prepare_scheduled_delivery(
    db: AsyncSession,
    endpoint_hash: str,
    *,
    scheduled_log_id: int,
) -> tuple[scheduled_repo.DeliveryClaim | None, str | None]:
    """실제 한 번의 외부 호출에 해당하는 endpoint 하나만 claim한다."""
    states = await scheduled_repo.get_delivery_states(
        db,
        scheduled_log_id=scheduled_log_id,
        endpoint_hashes=[endpoint_hash],
    )
    state = states.get(endpoint_hash)
    if state in {"completed", "unknown", "abandoned", "in_progress"}:
        return None, state

    claims = await scheduled_repo.claim_deliveries(
        db,
        scheduled_log_id=scheduled_log_id,
        endpoint_hashes=[endpoint_hash],
    )
    return (claims[0], None) if claims else (None, state)


async def _send_untracked_batch(
    db: AsyncSession,
    provider: PushProvider,
    batch: Sequence[PushSubscription],
    payload: dict[str, str],
    *,
    max_retries: int,
) -> tuple[int, int]:
    accepted = 0
    failed = 0
    log_items: list[send_logs.SendLogItem] = []
    expired_hashes: list[str] = []

    for sub in batch:
        try:
            endpoint_plain = _decrypt_subscription(sub)
        except CryptoError:
            failed += 1
            log_items.append(
                send_logs.SendLogItem(
                    ok=False,
                    status_code=None,
                    stored_endpoint_hash=cast(str, sub.endpoint_hash),
                )
            )
            continue

        attempt = await _send_with_retry(
            provider, sub, payload, max_retries=max_retries
        )
        if attempt.ok:
            accepted += 1
        else:
            failed += 1
            if attempt.status_code in (404, 410):
                expired_hashes.append(subs_repo.hash_endpoint(endpoint_plain))
        log_items.append(
            send_logs.SendLogItem(
                endpoint=endpoint_plain,
                ok=attempt.ok,
                status_code=attempt.status_code,
            )
        )

    await send_logs.create_logs_batch(db, log_items)
    await subs_repo.remove_by_endpoint_hashes(db, expired_hashes)
    return accepted, failed


async def send_batch_chunk(
    db: AsyncSession,
    provider: PushProvider,
    batch: Sequence[PushSubscription],
    payload: dict[str, str],
    config: DeliveryBatchConfig,
) -> tuple[int, int]:
    """일반 또는 예약 발송 배치 한 덩어리를 처리한다."""
    scheduled_log_id = config.scheduled_log_id
    if scheduled_log_id is None:
        return await _send_untracked_batch(
            db,
            provider,
            batch,
            payload,
            max_retries=config.max_retries,
        )

    accepted = 0
    failed = 0
    log_items: list[send_logs.SendLogItem] = []
    expired_hashes: list[str] = []

    for sub in batch:
        endpoint_hash = cast(str, sub.endpoint_hash)
        claim, state = await _prepare_scheduled_delivery(
            db,
            endpoint_hash,
            scheduled_log_id=scheduled_log_id,
        )
        if claim is None:
            if state == "unknown":
                failed += 1
                log_items.append(
                    send_logs.SendLogItem(
                        ok=False,
                        status_code=None,
                        stored_endpoint_hash=endpoint_hash,
                    )
                )
            # completed/abandoned/in_progress 또는 다른 워커가 잠근 행이다.
            continue

        try:
            endpoint_plain = _decrypt_subscription(sub)
        except CryptoError:
            attempt = _DeliveryAttempt(ok=False, status_code=None)
            endpoint_plain = None
        else:
            attempt = await _send_with_retry(
                provider, sub, payload, max_retries=config.max_retries
            )

        # claim 단위와 실제 외부 호출 단위를 일치시켜, 배치 후반의 미송신
        # endpoint가 프로세스 중단 때문에 unknown으로 같이 탈락하지 않게 한다.
        await scheduled_repo.record_delivery_results(
            db,
            results=[
                scheduled_repo.DeliveryResult(
                    claim=claim,
                    ok=attempt.ok,
                    status_code=attempt.status_code,
                    uncertain=attempt.uncertain,
                )
            ],
        )
        if attempt.ok:
            accepted += 1
        else:
            failed += 1
            if endpoint_plain is not None and attempt.status_code in (404, 410):
                expired_hashes.append(subs_repo.hash_endpoint(endpoint_plain))
        if endpoint_plain is None:
            log_items.append(
                send_logs.SendLogItem(
                    ok=attempt.ok,
                    status_code=attempt.status_code,
                    stored_endpoint_hash=endpoint_hash,
                )
            )
        else:
            log_items.append(
                send_logs.SendLogItem(
                    endpoint=endpoint_plain,
                    ok=attempt.ok,
                    status_code=attempt.status_code,
                )
            )

    # 일반 발송 로그 저장이 실패해도 delivery 결과는 이미 endpoint별로
    # 커밋되어 다음 예약 실행의 재시도 경계를 보존한다.
    await send_logs.create_logs_batch(db, log_items)
    await subs_repo.remove_by_endpoint_hashes(db, expired_hashes)
    return accepted, failed
