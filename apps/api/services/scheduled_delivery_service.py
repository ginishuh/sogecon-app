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


async def _send_with_retry(
    provider: PushProvider,
    sub: PushSubscription,
    payload: dict[str, str],
    *,
    max_retries: int,
) -> tuple[bool, int | None]:
    """지수 백오프로 일시적 Push 실패를 재시도한다."""
    status: int | None = None
    for attempt in range(max_retries + 1):
        ok, status = await provider.send_async(sub, payload)
        if ok or status in (400, 404, 410):
            return ok, status
        if attempt < max_retries:
            await asyncio.sleep((2**attempt) * 0.5)
    return False, status


async def _prepare_scheduled_batch(
    db: AsyncSession,
    batch: Sequence[PushSubscription],
    *,
    scheduled_log_id: int,
) -> tuple[dict[str, scheduled_repo.DeliveryClaim], list[send_logs.SendLogItem], int]:
    """이미 처리된 endpoint를 제외하고 이번 배치의 claim을 준비한다."""
    hashes = [cast(str, sub.endpoint_hash) for sub in batch]
    states = await scheduled_repo.get_delivery_states(
        db,
        scheduled_log_id=scheduled_log_id,
        endpoint_hashes=hashes,
    )
    claims = await scheduled_repo.claim_deliveries(
        db,
        scheduled_log_id=scheduled_log_id,
        endpoint_hashes=hashes,
    )
    claim_by_hash = {claim.endpoint_hash: claim for claim in claims}
    skipped_logs: list[send_logs.SendLogItem] = []
    skipped_failed = 0
    for endpoint_hash, state in states.items():
        if state == "unknown":
            skipped_logs.append(
                send_logs.SendLogItem(
                    ok=False,
                    status_code=None,
                    stored_endpoint_hash=endpoint_hash,
                )
            )
            skipped_failed += 1
    return claim_by_hash, skipped_logs, skipped_failed


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
            endpoint_plain = decrypt_str(cast(str, sub.endpoint))
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

        ok, status = await _send_with_retry(
            provider, sub, payload, max_retries=max_retries
        )
        if ok:
            accepted += 1
        else:
            failed += 1
            if status in (404, 410):
                expired_hashes.append(subs_repo.hash_endpoint(endpoint_plain))
        log_items.append(
            send_logs.SendLogItem(endpoint=endpoint_plain, ok=ok, status_code=status)
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

    claim_by_hash, log_items, failed = await _prepare_scheduled_batch(
        db,
        batch,
        scheduled_log_id=scheduled_log_id,
    )
    accepted = 0
    delivery_results: list[scheduled_repo.DeliveryResult] = []
    expired_hashes: list[str] = []

    for sub in batch:
        endpoint_hash = cast(str, sub.endpoint_hash)
        claim = claim_by_hash.get(endpoint_hash)
        if claim is None:
            # completed/unknown 또는 다른 워커가 잠근 행이다.
            continue

        try:
            endpoint_plain = decrypt_str(cast(str, sub.endpoint))
        except CryptoError:
            ok = False
            status = None
            endpoint_plain = None
        else:
            ok, status = await _send_with_retry(
                provider, sub, payload, max_retries=config.max_retries
            )

        delivery_results.append(
            scheduled_repo.DeliveryResult(
                claim=claim,
                ok=ok,
                status_code=status,
            )
        )
        if ok:
            accepted += 1
        else:
            failed += 1
            if endpoint_plain is not None and status in (404, 410):
                expired_hashes.append(subs_repo.hash_endpoint(endpoint_plain))
        if endpoint_plain is None:
            log_items.append(
                send_logs.SendLogItem(
                    ok=ok,
                    status_code=status,
                    stored_endpoint_hash=endpoint_hash,
                )
            )
        else:
            log_items.append(
                send_logs.SendLogItem(
                    endpoint=endpoint_plain,
                    ok=ok,
                    status_code=status,
                )
            )

    # 외부 호출 결과를 먼저 영속화한다. 이후 일반 발송 로그 저장이 실패해도
    # 다음 예약 실행은 완료/실패/불확실 상태를 기준으로 중복을 방지한다.
    await scheduled_repo.record_delivery_results(db, results=delivery_results)
    await send_logs.create_logs_batch(db, log_items)
    await subs_repo.remove_by_endpoint_hashes(db, expired_hashes)
    return accepted, failed
