from __future__ import annotations

import enum
from datetime import datetime
from typing import Literal, TypedDict

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator

VisibilityLiteral = Literal["all", "cohort", "private"]
RSVPLiteral = Literal["going", "waitlist", "cancel"]


class MemberBase(BaseModel):
    email: EmailStr
    name: str
    cohort: int
    major: str | None = None
    roles: str = "member"
    visibility: VisibilityLiteral = "all"
    birth_date: str | None = None  # 'YYYY-MM-DD'
    birth_lunar: bool | None = None
    phone: str | None = None


class MemberCreate(MemberBase):
    pass


class MemberRead(MemberBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

    @field_validator("visibility", mode="before")
    @classmethod
    def _visibility_from_enum(cls, v: object) -> object:
        if isinstance(v, enum.Enum):
            return v.value
        return v


class MemberUpdate(BaseModel):
    name: str | None = None
    major: str | None = None
    visibility: VisibilityLiteral | None = None
    birth_date: str | None = None
    birth_lunar: bool | None = None
    phone: str | None = None


class MemberListFilters(TypedDict, total=False):
    q: str
    cohort: int
    major: str
    exclude_private: bool


class PostBase(BaseModel):
    title: str
    content: str
    published_at: datetime | None = None


class PostCreate(PostBase):
    author_id: int


class PostRead(PostBase):
    id: int
    author_id: int

    model_config = ConfigDict(from_attributes=True)


class EventBase(BaseModel):
    title: str
    starts_at: datetime
    ends_at: datetime
    location: str
    capacity: int


class EventCreate(EventBase):
    pass


class EventRead(EventBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class RSVPBase(BaseModel):
    member_id: int
    event_id: int
    status: RSVPLiteral = "going"


class RSVPCreate(RSVPBase):
    pass


class RSVPStatusUpdate(BaseModel):
    member_id: int
    status: RSVPLiteral = "going"


class RSVPRead(RSVPBase):
    model_config = ConfigDict(from_attributes=True)

    @field_validator("status", mode="before")
    @classmethod
    def _status_from_enum(cls, v: object) -> object:
        if isinstance(v, enum.Enum):
            return v.value
        return v


class Pagination(BaseModel):
    limit: int = 10
    offset: int = 0
