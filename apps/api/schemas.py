from __future__ import annotations

import enum
import re
from datetime import datetime
from typing import Literal, TypedDict

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    ValidationInfo,
    computed_field,
    field_validator,
)

from .config import get_settings
from .media_utils import (
    build_media_url,
    build_media_urls,
    normalize_media_path,
    normalize_media_paths,
)
from .services.roles_service import RoleGradeLiteral

VisibilityLiteral = Literal["all", "cohort", "private"]
RSVPLiteral = Literal["going", "waitlist", "cancel"]
EventStatusLiteral = Literal["upcoming", "ongoing", "ended"]
HeroTargetTypeLiteral = Literal["post", "event"]
MemberStatusLiteral = Literal["pending", "active", "suspended", "rejected"]
SignupRequestStatusLiteral = Literal["pending", "approved", "rejected", "activated"]

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
    student_id: str
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
    status: MemberStatusLiteral = "active"
    avatar_path: str | None = Field(default=None, exclude=True)

    model_config = ConfigDict(from_attributes=True)

    @field_validator("visibility", mode="before")
    @classmethod
    def _visibility_from_enum(cls, v: object) -> object:
        if isinstance(v, enum.Enum):
            return v.value
        return v

    @computed_field(return_type=str | None)
    def avatar_url(self) -> str | None:
        return _avatar_url_from_path(self.avatar_path)


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
    job_title: str
    sort: str


class AdminUserRolesRead(BaseModel):
    student_id: str
    email: EmailStr | None = None
    name: str | None = None
    has_member_record: bool
    roles: list[str]
    grade: RoleGradeLiteral
    permissions: list[str]


class AdminUserRolesListResponse(BaseModel):
    items: list[AdminUserRolesRead]
    total: int


class AdminUserRolesUpdatePayload(BaseModel):
    roles: list[str] = Field(default_factory=list)


class AdminUserRolesUpdateResponse(BaseModel):
    updated: AdminUserRolesRead
    decided_by_student_id: str


class SignupRequestBase(BaseModel):
    student_id: str
    email: EmailStr
    name: str
    cohort: int
    major: str | None = None
    phone: str | None = None
    note: str | None = None
    status: SignupRequestStatusLiteral = "pending"
    requested_at: datetime | None = None
    decided_at: datetime | None = None
    activated_at: datetime | None = None
    decided_by_student_id: str | None = None
    reject_reason: str | None = None


class SignupRequestCreate(BaseModel):
    student_id: str
    email: EmailStr
    name: str
    cohort: int
    major: str | None = None
    phone: str | None = None
    note: str | None = None

    @field_validator("phone")
    @classmethod
    def _validate_phone(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        if not _PHONE_PATTERN.fullmatch(trimmed):
            raise ValueError("전화번호는 숫자, +, -, 공백으로만 7~20자 입력해주세요.")
        return trimmed


class SignupRequestRead(SignupRequestBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class SignupRequestListFilters(TypedDict, total=False):
    q: str
    status: SignupRequestStatusLiteral


class AdminEventListFilters(TypedDict, total=False):
    """관리자 행사 목록 필터(내부용)."""

    q: str
    date_from: datetime
    date_to: datetime
    status: EventStatusLiteral


class PostBase(BaseModel):
    title: str
    content: str
    published_at: datetime | None = None
    category: str | None = None
    pinned: bool = False
    cover_image: str | None = None
    images: list[str] | None = None  # 추가 이미지 URL 배열
    view_count: int = 0


class PostCreate(PostBase):
    author_id: int | None = None

    @field_validator("cover_image", mode="before")
    @classmethod
    def _normalize_cover_image(cls, value: str | None) -> str | None:
        return normalize_media_path(value)

    @field_validator("images", mode="before")
    @classmethod
    def _normalize_images(cls, value: list[str] | None) -> list[str] | None:
        return normalize_media_paths(value)


class PostUpdate(BaseModel):
    """게시물 수정용 스키마 (부분 업데이트).

    필드를 요청에 포함하지 않으면 해당 필드는 변경되지 않음.
    포함된 필드는 None 포함 그대로 DB에 반영됨.
    """

    title: str | None = None
    content: str | None = None
    category: str | None = None
    pinned: bool | None = None
    published_at: datetime | None = Field(
        default=None,
        description="미포함→변경없음, 값→발행일시, null→비공개",
    )
    cover_image: str | None = None
    images: list[str] | None = None
    unpublish: bool = Field(
        default=False,
        description="True면 published_at을 None으로 강제 설정 (비공개 전환)",
    )

    @field_validator("cover_image", mode="before")
    @classmethod
    def _normalize_cover_image(cls, value: str | None) -> str | None:
        return normalize_media_path(value)

    @field_validator("images", mode="before")
    @classmethod
    def _normalize_images(cls, value: list[str] | None) -> list[str] | None:
        return normalize_media_paths(value)


class PostRead(PostBase):
    id: int
    author_id: int
    author_name: str | None = None  # 작성자 이름 (join 결과)
    view_count: int = 0
    comment_count: int = 0  # 댓글 수 (집계 결과)

    model_config = ConfigDict(from_attributes=True)

    @field_validator("cover_image", mode="before")
    @classmethod
    def _build_cover_image(cls, value: str | None) -> str | None:
        return build_media_url(value)

    @field_validator("images", mode="before")
    @classmethod
    def _build_images(cls, value: list[str] | None) -> list[str] | None:
        return build_media_urls(value)


class CommentBase(BaseModel):
    content: str


class CommentCreate(CommentBase):
    post_id: int
    author_id: int | None = None  # 회원은 자동 설정, 어드민은 명시


class CommentRead(CommentBase):
    id: int
    post_id: int
    author_id: int
    author_name: str | None = None  # 작성자 이름 (join 결과)
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EventBase(BaseModel):
    title: str
    description: str | None = None
    starts_at: datetime
    ends_at: datetime
    location: str
    capacity: int


class EventCreate(EventBase):
    pass


class EventRead(EventBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class RSVPCounts(BaseModel):
    """행사별 참여 현황 집계."""

    going: int = 0
    waitlist: int = 0
    cancel: int = 0


class EventAdminRead(EventRead):
    """관리자 행사 목록 전용 응답 (참여 집계 포함)."""

    rsvp_counts: RSVPCounts

    model_config = ConfigDict(from_attributes=True)


class EventUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    location: str | None = None
    capacity: int | None = None


class HeroItemBase(BaseModel):
    """홈 히어로 배너 슬롯(추천) 기본 스키마."""

    target_type: HeroTargetTypeLiteral
    target_id: int
    enabled: bool = True
    pinned: bool = False
    title_override: str | None = None
    description_override: str | None = None
    image_override: str | None = None


class HeroItemCreate(HeroItemBase):
    @field_validator("image_override", mode="before")
    @classmethod
    def _normalize_image_override(cls, value: str | None) -> str | None:
        return normalize_media_path(value)


class HeroItemUpdate(BaseModel):
    """히어로 배너 슬롯 부분 업데이트 스키마."""

    target_type: HeroTargetTypeLiteral | None = None
    target_id: int | None = None
    enabled: bool | None = None
    pinned: bool | None = None
    title_override: str | None = None
    description_override: str | None = None
    image_override: str | None = None

    @field_validator("image_override", mode="before")
    @classmethod
    def _normalize_image_override(cls, value: str | None) -> str | None:
        return normalize_media_path(value)


class HeroItemRead(HeroItemBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_validator("image_override", mode="before")
    @classmethod
    def _build_image_override(cls, value: str | None) -> str | None:
        return build_media_url(value)


class HeroSlide(BaseModel):
    """홈 히어로 캐러셀용 응답(대상 resolve 포함)."""

    id: int
    target_type: HeroTargetTypeLiteral
    target_id: int
    title: str
    description: str
    image: str | None = None
    href: str
    unpublished: bool = False

    @field_validator("image", mode="before")
    @classmethod
    def _build_image(cls, value: str | None) -> str | None:
        return build_media_url(value)


class HeroTargetLookupRequest(BaseModel):
    """관리자용: 대상(게시글/행사) ID 목록으로 hero_item 상태 조회."""

    target_type: HeroTargetTypeLiteral
    target_ids: list[int]


class HeroTargetLookupItem(BaseModel):
    """관리자용: 대상별 hero_item 요약."""

    target_id: int
    hero_item_id: int
    enabled: bool
    pinned: bool


class HeroTargetLookupResponse(BaseModel):
    items: list[HeroTargetLookupItem]


class RSVPBase(BaseModel):
    member_id: int
    event_id: int
    status: RSVPLiteral = "going"


class RSVPCreate(RSVPBase):
    pass


class MemberAuthCreate(BaseModel):
    student_id: str
    password: str


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
