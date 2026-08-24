"""지원문의 서비스 레이어."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from ..errors import ApiError
from ..models_support import SupportTicket
from ..repositories import support_tickets as tickets_repo


@dataclass
class ContactTicketInput:
    member_email: str | None
    subject: str
    body: str
    contact: str | None
    client_ip: str | None


async def create_contact_ticket(
    db: AsyncSession,
    payload: ContactTicketInput,
) -> None:
    try:
        await tickets_repo.create_ticket(
            db,
            {
                "member_email": payload.member_email,
                "subject": payload.subject,
                "body": payload.body,
                "contact": payload.contact,
                "client_ip": payload.client_ip,
            },
        )
    except SQLAlchemyError as exc:
        raise ApiError(
            code="support_ticket_persist_failed",
            detail="문의 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.",
            status=500,
        ) from exc


async def list_recent_tickets(
    db: AsyncSession,
    *,
    limit: int,
) -> Sequence[SupportTicket]:
    return await tickets_repo.list_recent(db, limit=limit)


def ticket_created_at_iso(ticket: SupportTicket) -> str:
    created = getattr(ticket, "created_at", None)
    if isinstance(created, datetime):
        return created.isoformat()
    return ""
