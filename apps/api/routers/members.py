from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from slowapi import Limiter
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status as http_status

from .. import schemas
from ..config import get_settings
from ..db import get_db
from ..directory_schemas import DirectoryViewRequestRead
from ..ratelimit import consume_limit, get_client_ip_for_rate_limit
from ..services import directory_view_request_service, members_service
from ..services import notifications_service as notif_svc
from .auth import CurrentMember, require_member

router = APIRouter(prefix="/members", tags=["members"])
limiter_view_request = Limiter(key_func=get_client_ip_for_rate_limit)


class MemberListParams(BaseModel):
    limit: int = Field(10, ge=1, le=100)
    offset: int = Field(0, ge=0)
    q: str | None = None
    cohort: int | None = None
    major: str | None = None
    company: str | None = None
    industry: str | None = None
    region: str | None = None
    job_title: str | None = None
    sort: Literal["recent", "cohort_desc", "cohort_asc", "name"] = "recent"


@router.get("/", response_model=list[schemas.DirectoryMemberRead])
async def list_members(
    params: MemberListParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_member: CurrentMember = Depends(require_member),
) -> list[schemas.DirectoryMemberRead]:
    filters: schemas.MemberListFilters = {}
    if params.q:
        filters['q'] = params.q
    if params.cohort is not None:
        filters['cohort'] = int(params.cohort)
    if params.major:
        filters['major'] = params.major
    if params.company:
        filters['company'] = params.company
    if params.industry:
        filters['industry'] = params.industry
    if params.region:
        filters['region'] = params.region
    if params.job_title:
        filters['job_title'] = params.job_title
    if params.sort:
        filters['sort'] = params.sort
    return await members_service.list_directory_members(
        db,
        limit=params.limit,
        offset=params.offset,
        filters=filters,
        viewer_student_id=current_member.student_id,
    )


class MemberCount(BaseModel):
    count: int


@router.get("/count", response_model=MemberCount)
async def count_members(
    params: MemberListParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_member: CurrentMember = Depends(require_member),
) -> MemberCount:
    filters: schemas.MemberListFilters = {}
    if params.q:
        filters['q'] = params.q
    if params.cohort is not None:
        filters['cohort'] = int(params.cohort)
    if params.major:
        filters['major'] = params.major
    if params.company:
        filters['company'] = params.company
    if params.industry:
        filters['industry'] = params.industry
    if params.region:
        filters['region'] = params.region
    if params.job_title:
        filters['job_title'] = params.job_title
    c = await members_service.count_directory_members(
        db,
        filters=filters,
        viewer_student_id=current_member.student_id,
    )
    return MemberCount(count=c)


@router.post(
    "/{member_id}/view-requests",
    response_model=DirectoryViewRequestRead,
    status_code=http_status.HTTP_201_CREATED,
)
async def create_directory_view_request(
    member_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_member: CurrentMember = Depends(require_member),
) -> DirectoryViewRequestRead:
    settings = get_settings()
    consume_limit(limiter_view_request, request, settings.rate_limit_view_request)
    if current_member.id is not None:
        requester = await members_service.get_member(db, current_member.id)
    else:
        requester = await members_service.get_member_by_student_id(
            db, current_member.student_id
        )
    created = await directory_view_request_service.create_view_request(
        db, requester=requester, target_id=member_id
    )
    await notif_svc.send_to_member(
        db,
        notif_svc.PyWebPushProvider(),
        member_id=member_id,
        payload={
            "title": "동문 수첩 보기 요청",
            "body": f"{requester.name}님이 회원님 정보를 보고 싶어 합니다.",
            "url": "/me",
        },
    )
    return created


@router.get("/{member_id}", response_model=schemas.DirectoryMemberRead)
async def get_member(
    member_id: int,
    db: AsyncSession = Depends(get_db),
    current_member: CurrentMember = Depends(require_member),
) -> schemas.DirectoryMemberRead:
    return await members_service.get_directory_member(
        db,
        member_id=member_id,
        viewer_student_id=current_member.student_id,
    )
