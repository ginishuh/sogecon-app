from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import schemas
from ..db import get_db
from ..services import members_service
from .auth import CurrentAdmin, require_admin

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
def list_members(
    params: MemberListParams = Depends(), db: Session = Depends(get_db)
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
    members = members_service.list_members(
        db, limit=params.limit, offset=params.offset, filters=filters
    )
    return [schemas.MemberRead.model_validate(member) for member in members]


class MemberCount(BaseModel):
    count: int


@router.get("/count", response_model=MemberCount)
def count_members(
    params: MemberListParams = Depends(), db: Session = Depends(get_db)
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
    c = members_service.count_members(db, filters=filters)
    return MemberCount(count=c)


@router.get("/{member_id}", response_model=schemas.MemberRead)
def get_member(member_id: int, db: Session = Depends(get_db)) -> schemas.MemberRead:
    member = members_service.get_member(db, member_id)
    return schemas.MemberRead.model_validate(member)


@router.post("/", response_model=schemas.MemberRead, status_code=201)
def create_member(
    payload: schemas.MemberCreate,
    db: Session = Depends(get_db),
    _admin: CurrentAdmin = Depends(require_admin),
) -> schemas.MemberRead:
    member = members_service.create_member(db, payload)
    return schemas.MemberRead.model_validate(member)
