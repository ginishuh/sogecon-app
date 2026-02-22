from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from .. import schemas
from ..db import get_db
from ..services import members_service
from .auth import CurrentMember, require_member

router = APIRouter(prefix="/members", tags=["members"])


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


@router.get("/", response_model=list[schemas.MemberRead])
async def list_members(
    params: MemberListParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _member: CurrentMember = Depends(require_member),
) -> list[schemas.MemberRead]:
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
    members = await members_service.list_members(
        db, limit=params.limit, offset=params.offset, filters=filters
    )
    return [schemas.MemberRead.model_validate(member) for member in members]


class MemberCount(BaseModel):
    count: int


@router.get("/count", response_model=MemberCount)
async def count_members(
    params: MemberListParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _member: CurrentMember = Depends(require_member),
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
    c = await members_service.count_members(db, filters=filters)
    return MemberCount(count=c)


@router.get("/{member_id}", response_model=schemas.MemberRead)
async def get_member(
    member_id: int,
    db: AsyncSession = Depends(get_db),
    _member: CurrentMember = Depends(require_member),
) -> schemas.MemberRead:
    member = await members_service.get_member(db, member_id)
    return schemas.MemberRead.model_validate(member)


