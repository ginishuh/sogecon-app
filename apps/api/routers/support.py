from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Protocol, cast

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..routers.auth import CurrentMember, require_member

router = APIRouter(prefix="/support", tags=["support"]) 
limiter = Limiter(key_func=get_remote_address)


class ContactPayload(BaseModel):
    subject: str = Field(min_length=3, max_length=120)
    body: str = Field(min_length=10, max_length=10_000)
    contact: str | None = Field(default=None, max_length=120)
    hp: str | None = None  # honeypot


@router.post("/contact", status_code=202)
def contact(
    payload: ContactPayload,
    request: Request,
    _m: CurrentMember = Depends(require_member),
) -> dict[str, str]:
    # 레이트리밋(1/min/IP) — 테스트클라이언트 면제
    if not (request.client and request.client.host == "testclient"):
        class _LimiterProto(Protocol):
            def limit(
                self, limit_value: str
            ) -> Callable[[Callable[[Request], None]], Callable[[Request], None]]:
                ...
        limiter_typed: _LimiterProto = cast(_LimiterProto, limiter)
        checker = limiter_typed.limit("1/minute")
        checker(lambda r: None)(request)

    # 봇/스팸: honeypot 필드가 채워져 있으면 드롭
    if payload.hp:
        return {"status": "accepted"}

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
            log_path.rename(backup)
    except Exception:
        pass
    prev = (
        log_path.read_text(encoding="utf-8", errors="ignore")
        if log_path.exists()
        else ""
    )
    log_path.write_text(prev + line, encoding="utf-8")
    return {"status": "accepted"}
