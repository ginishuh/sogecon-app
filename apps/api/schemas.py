from __future__ import annotations

import enum
import re
from datetime import datetime
from typing import Literal, TypedDict

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    ValidationInfo,
    field_validator,
    model_validator,
)

from .config import get_settings

VisibilityLiteral = Literal["all", "cohort", "private"]
RSVPLiteral = Literal["going", "waitlist", "cancel"]

_PHONE_PATTERN = re.compile(r'^[0-9+\-\s]{7,20}$')
_TEXT_LIMITS: dict[str, tuple[int, int, str]] = {
    "department": (1, 80, "부서"),
    "job_title": (1, 80, "직함"),
    "addr_personal": (1, 200, "개인 주소"),
    "addr_company": (1, 200, "회사 주소"),
    "industry": (1, 60, "업종"),
}


def _avatar_url_from_path(path: str | None) -> str | None:
    if not path:
        return None
    settings = get_settings()
    base = settings.media_url_base.rstrip('/')
    return f"{base}/{path.lstrip('/')}"


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
    company: str | None = None
    department: str | None = None
    job_title: str | None = None
    company_phone: str | None = None
    addr_personal: str | None = None
    addr_company: str | None = None
    industry: str | None = None


class MemberCreate(MemberBase):
    pass


class MemberRead(MemberBase):
    id: int
    avatar_url: str | None = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator("visibility", mode="before")
    @classmethod
    def _visibility_from_enum(cls, v: object) -> object:
        if isinstance(v, enum.Enum):
            return v.value
        return v

    @model_validator(mode="before")
    @classmethod
    def _inject_avatar_url(cls, data: object) -> object:
        if data is None:
            return data
        if isinstance(data, dict):
            avatar_path = data.get("avatar_path")
            if avatar_path and not data.get("avatar_url"):
                new_data = dict(data)
                new_data["avatar_url"] = _avatar_url_from_path(avatar_path)
                return new_data
            return data
        avatar_path = getattr(data, "avatar_path", None)
        if avatar_path:
            setattr(data, "avatar_url", _avatar_url_from_path(avatar_path))
        return data


class MemberUpdate(BaseModel):
    name: str | None = None
    major: str | None = None
    visibility: VisibilityLiteral | None = None
    birth_date: str | None = None
    birth_lunar: bool | None = None
    phone: str | None = None
    company: str | None = None
    department: str | None = None
    job_title: str | None = None
    company_phone: str | None = None
    addr_personal: str | None = None
    addr_company: str | None = None
    industry: str | None = None

    @field_validator("phone", "company_phone")
    @classmethod
    def _validate_phone(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        if not _PHONE_PATTERN.fullmatch(trimmed):
            raise ValueError("전화번호는 숫자, +, -, 공백으로만 7~20자 입력해주세요.")
        return trimmed

    @field_validator(
        "department",
        "job_title",
        "addr_personal",
        "addr_company",
        "industry",
    )
    @classmethod
    def _validate_text_length(
        cls, value: str | None, info: ValidationInfo
    ) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        field_name = info.field_name or ""
        limits: tuple[int, int, str] | None = _TEXT_LIMITS.get(field_name)
        if limits is None:
            return trimmed
        min_len, max_len, label = limits
        length = len(trimmed)
        if length < min_len or length > max_len:
            raise ValueError(f"{label}은 {min_len}~{max_len}자 이내로 입력해주세요.")
        return trimmed


class MemberListFilters(TypedDict, total=False):
    q: str
    cohort: int
    major: str
    company: str
    industry: str
    region: str
    exclude_private: bool


class PostBase(BaseModel):
    title: str
    content: str
    published_at: datetime | None = None
    category: str | None = None
    pinned: bool = False
    cover_image: str | None = None


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
