from __future__ import annotations

from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.sql import func

from .models import Base


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    member_email = Column(String(255), nullable=True, index=True)
    subject = Column(String(120), nullable=False)
    body = Column(String(10_000), nullable=False)
    contact = Column(String(120), nullable=True)
    client_ip = Column(String(64), nullable=True)
