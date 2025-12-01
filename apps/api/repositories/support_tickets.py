from __future__ import annotations

from collections.abc import Sequence
from typing import NotRequired, TypedDict

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models_support import SupportTicket


class TicketCreate(TypedDict):
    subject: str
    body: str
    member_email: NotRequired[str | None]
    contact: NotRequired[str | None]
    client_ip: NotRequired[str | None]


async def create_ticket(db: AsyncSession, data: TicketCreate) -> SupportTicket:
    row = SupportTicket(
        member_email=data.get("member_email"),
        subject=data["subject"],
        body=data["body"],
        contact=data.get("contact"),
        client_ip=data.get("client_ip"),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def list_recent(db: AsyncSession, *, limit: int = 50) -> Sequence[SupportTicket]:
    stmt = select(SupportTicket).order_by(desc(SupportTicket.created_at)).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()
