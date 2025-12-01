from __future__ import annotations

import logging
import re
import time
from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..db import get_db
from ..ratelimit import consume_limit
from ..repositories import support_tickets as tickets_repo
from ..routers.auth import CurrentAdmin, CurrentMember, require_admin, require_member

router = APIRouter(prefix="/support", tags=["support"])
limiter = Limiter(key_func=get_remote_address)


def _is_test_client(request: Request) -> bool:
    return bool(request.client and request.client.host == "testclient")

# 최근 중복/쿨다운 체크(간단 메모리)
_recent: dict[str, tuple[float, str]] = {}
_COOLDOWN_SEC = 60.0
_BLOCKLIST = re.compile(r"(viagra|casino|loan|bet|bitcoin|crypto|porn)", re.I)


class ContactPayload(BaseModel):
    subject: str = Field(min_length=3, max_length=120)
    body: str = Field(min_length=10, max_length=10_000)
    contact: str | None = Field(default=None, max_length=120)
    hp: str | None = None  # honeypot


@router.post("/contact", status_code=202)
async def contact(
    payload: ContactPayload,
    request: Request,
    _m: CurrentMember = Depends(require_member),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    if not _is_test_client(request):
        consume_limit(limiter, request, get_settings().rate_limit_support)

    # 봇/스팸: honeypot 또는 키워드 차단 → 드롭(accepted)
    if payload.hp or _BLOCKLIST.search(payload.subject) or _BLOCKLIST.search(
        payload.body
    ):
        return {"status": "accepted"}

    # 최근 동일 사용자(또는 세션 IP) 중복/쿨다운 드롭
    host = request.client.host if request.client else ""
    email = getattr(_m, "email", "") or ""
    ident = f"{host}|{email}"
    h = f"{payload.subject}\n{payload.body}"
    now = time.monotonic()
    t_prev, h_prev = _recent.get(ident, (0.0, ""))
    if h_prev == h and (now - t_prev) < _COOLDOWN_SEC:
        _recent[ident] = (now, h)
        return {"status": "accepted"}
    _recent[ident] = (now, h)

    # DB 티켓 저장
    await tickets_repo.create_ticket(
        db,
        {
            "member_email": (getattr(_m, "email", None) if _m else None),
            "subject": payload.subject,
            "body": payload.body,
            "contact": payload.contact,
            "client_ip": (request.client.host if request.client else None),
        },
    )

    # 개발 단계: 파일 로그로 보관(간단 로테이션)
    logs_dir = Path("logs")
    logs_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(UTC).isoformat()
    line = (
        f"{ts}\t{payload.subject}\t{payload.contact or ''}\n{payload.body}\n---\n"
    )
    log_path = logs_dir / "support.log"
    try:
        if log_path.exists() and log_path.stat().st_size > 1 * 1024 * 1024:
            backup = logs_dir / "support.log.1"
            if backup.exists():
                backup.unlink()
            log_path.replace(backup)
    except (OSError, PermissionError) as e:
        logging.getLogger(__name__).warning("support.log rotation failed: %s", e)
    prev = (
        log_path.read_text(encoding="utf-8", errors="ignore")
        if log_path.exists()
        else ""
    )
    log_path.write_text(prev + line, encoding="utf-8")
    return {"status": "accepted"}


class TicketRead(BaseModel):
    created_at: str
    member_email: str | None
    subject: str
    contact: str | None
    client_ip: str | None


@router.get("/admin/tickets", response_model=list[TicketRead])
async def list_tickets(
    _admin: CurrentAdmin = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
) -> list[TicketRead]:
    rows = await tickets_repo.list_recent(db, limit=min(max(limit, 1), 200))
    out: list[TicketRead] = []
    for r in rows:
        created = getattr(r, 'created_at', None)
        out.append(TicketRead(
            created_at=(created.isoformat() if created else ''),
            member_email=getattr(r, 'member_email', None),
            subject=getattr(r, 'subject', ''),
            contact=getattr(r, 'contact', None),
            client_ip=getattr(r, 'client_ip', None),
        ))
    return out
