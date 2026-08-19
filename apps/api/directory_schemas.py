from __future__ import annotations

import enum
from datetime import datetime
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    computed_field,
    field_validator,
)

from .media_utils import build_media_url

ViewRequestStatusLiteral = Literal["pending", "accepted", "declined", "revoked"]


class DirectoryMemberRead(BaseModel):
    """동문 수첩용 최소 응답. 인증·역할·학번은 노출하지 않는다."""

    id: int
    name: str
    cohort: int
    visibility: Literal["all", "cohort", "private"]
    details_visible: bool = True
    view_request: ViewRequestStatusLiteral | None = None
    email: EmailStr | None = None
    major: str | None = None
    phone: str | None = None
    company: str | None = None
    department: str | None = None
    job_title: str | None = None
    company_phone: str | None = None
    addr_personal: str | None = None
    addr_company: str | None = None
    industry: str | None = None
    avatar_path: str | None = Field(default=None, exclude=True)

    model_config = ConfigDict(from_attributes=True)

    @field_validator("visibility", mode="before")
    @classmethod
    def _visibility_from_enum(cls, value: object) -> object:
        if isinstance(value, enum.Enum):
            return value.value
        return value

    @computed_field(return_type=str | None)
    def avatar_url(self) -> str | None:
        return build_media_url(self.avatar_path)


class DirectoryConsentWrite(BaseModel):
    visibility: Literal["all", "cohort", "private"]


class DirectoryViewRequestRead(BaseModel):
    id: int
    requester_id: int
    requester_name: str
    requester_cohort: int
    target_id: int
    status: ViewRequestStatusLiteral
    created_at: datetime
    decided_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
