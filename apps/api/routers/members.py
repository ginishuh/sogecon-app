from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .. import schemas
from ..db import get_db
from ..services import members_service
from .auth import require_admin

router = APIRouter(prefix="/members", tags=["members"])


@router.get("/", response_model=list[schemas.MemberRead])
def list_members(
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> list[schemas.MemberRead]:
    members = members_service.list_members(db, limit=limit, offset=offset)
    return [schemas.MemberRead.model_validate(member) for member in members]


@router.get("/{member_id}", response_model=schemas.MemberRead)
def get_member(member_id: int, db: Session = Depends(get_db)) -> schemas.MemberRead:
    member = members_service.get_member(db, member_id)
    return schemas.MemberRead.model_validate(member)


@router.post("/", response_model=schemas.MemberRead, status_code=201)
def create_member(
    payload: schemas.MemberCreate,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
) -> schemas.MemberRead:
    member = members_service.create_member(db, payload)
    return schemas.MemberRead.model_validate(member)
