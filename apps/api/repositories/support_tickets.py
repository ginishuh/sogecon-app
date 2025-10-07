from __future__ import annotations

from collections.abc import Sequence
from typing import NotRequired, TypedDict

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from ..models_support import SupportTicket


class TicketCreate(TypedDict):
    subject: str
    body: str
    member_email: NotRequired[str | None]
    contact: NotRequired[str | None]
    client_ip: NotRequired[str | None]


def create_ticket(db: Session, data: TicketCreate) -> SupportTicket:
    row = SupportTicket(
        member_email=data.get("member_email"),
        subject=data["subject"],
        body=data["body"],
        contact=data.get("contact"),
        client_ip=data.get("client_ip"),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def list_recent(db: Session, *, limit: int = 50) -> Sequence[SupportTicket]:
    stmt = select(SupportTicket).order_by(desc(SupportTicket.created_at)).limit(limit)
    return db.execute(stmt).scalars().all()
