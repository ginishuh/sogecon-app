from __future__ import annotations

import hashlib
import re
import time

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, EmailStr, Field
from slowapi import Limiter
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..db import get_db
from ..ratelimit import consume_limit, get_client_ip_for_rate_limit
from ..routers.auth import (
    CurrentMember,
    CurrentUser,
    get_optional_member,
    require_permission,
)
from ..services import support_service

router = APIRouter(prefix="/support", tags=["support"])
limiter = Limiter(key_func=get_client_ip_for_rate_limit)

# process-local duplicate suppression (best-effort; not exactly-once across workers)
_COOLDOWN_SEC = 60.0
_COOLDOWN_MAX_ENTRIES = 1024
_recent: dict[str, tuple[float, str]] = {}
_BLOCKLIST = re.compile(r"(viagra|casino|loan|bet|bitcoin|crypto|porn)", re.I)


class ContactPayload(BaseModel):
    subject: str = Field(min_length=3, max_length=120)
    body: str = Field(min_length=10, max_length=10_000)
    contact: EmailStr = Field(max_length=120)
    hp: str | None = None  # honeypot


def _payload_digest(payload: ContactPayload) -> str:
    canonical = f"{payload.subject}\n{payload.body}\n{payload.contact or ''}"
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _cooldown_ident(member_id: int | None, client_ip: str) -> str:
    if member_id is not None:
        return f"member:{member_id}"
    ip_digest = hashlib.sha256(client_ip.encode("utf-8")).hexdigest()
    return f"anonymous:{ip_digest}"


def _purge_cooldown(now: float) -> None:
    expired = [
        key
        for key, (committed_at, _) in _recent.items()
        if (now - committed_at) >= _COOLDOWN_SEC
    ]
    for key in expired:
        del _recent[key]
    overflow = len(_recent) - _COOLDOWN_MAX_ENTRIES
    if overflow <= 0:
        return
    for key, _ in sorted(_recent.items(), key=lambda item: item[1][0])[:overflow]:
        del _recent[key]


def _is_duplicate_submission(ident: str, digest: str, now: float) -> bool:
    _purge_cooldown(now)
    prev = _recent.get(ident)
    if prev is None:
        return False
    committed_at, prev_digest = prev
    if prev_digest != digest:
        return False
    return (now - committed_at) < _COOLDOWN_SEC


def _record_successful_submission(ident: str, digest: str, now: float) -> None:
    _recent[ident] = (now, digest)
    _purge_cooldown(now)


def reset_cooldown_cache_for_tests() -> None:
    _recent.clear()


@router.post("/contact", status_code=202)
async def contact(
    payload: ContactPayload,
    request: Request,
    member: CurrentMember | None = Depends(get_optional_member),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    consume_limit(limiter, request, get_settings().rate_limit_support)

    # 봇/스팸: honeypot 또는 키워드 차단 → 드롭(accepted)
    if payload.hp or _BLOCKLIST.search(payload.subject) or _BLOCKLIST.search(
        payload.body
    ):
        return {"status": "accepted"}

    client_ip = get_client_ip_for_rate_limit(request)
    member_id = member.id if member is not None else None
    ident = _cooldown_ident(member_id, client_ip)
    digest = _payload_digest(payload)
    now = time.monotonic()
    if _is_duplicate_submission(ident, digest, now):
        return {"status": "accepted"}

    await support_service.create_contact_ticket(
        db,
        support_service.ContactTicketInput(
            member_email=member.email if member is not None else None,
            subject=payload.subject,
            body=payload.body,
            contact=payload.contact,
            client_ip=client_ip if client_ip != "unknown" else None,
        ),
    )
    _record_successful_submission(ident, digest, time.monotonic())
    return {"status": "accepted"}


class TicketRead(BaseModel):
    id: int
    created_at: str
    member_email: str | None
    subject: str
    body: str
    contact: str | None
    client_ip: str | None


@router.get("/admin/tickets", response_model=list[TicketRead])
async def list_tickets(
    _admin: CurrentUser = Depends(
        require_permission("admin_support", allow_admin_fallback=False)
    ),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
) -> list[TicketRead]:
    rows = await support_service.list_recent_tickets(db, limit=limit)
    out: list[TicketRead] = []
    for row in rows:
        out.append(
            TicketRead(
                id=getattr(row, "id", 0),
                created_at=support_service.ticket_created_at_iso(row),
                member_email=getattr(row, "member_email", None),
                subject=getattr(row, "subject", ""),
                body=getattr(row, "body", ""),
                contact=getattr(row, "contact", None),
                client_ip=getattr(row, "client_ip", None),
            )
        )
    return out
