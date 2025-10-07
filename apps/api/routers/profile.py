from __future__ import annotations

from typing import cast

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from apps.api import schemas
from apps.api.db import get_db
from apps.api.routers.auth import CurrentMember, require_member
from apps.api.services import members_service

router = APIRouter(prefix="/me", tags=["me"]) 


@router.get("/", response_model=schemas.MemberRead)
def get_me(
    db: Session = Depends(get_db), m: CurrentMember = Depends(require_member)
) -> schemas.MemberRead:
    row = members_service.get_member_by_email(db, m.email)
    return schemas.MemberRead.model_validate(row)


@router.put("/", response_model=schemas.MemberRead)
def update_me(
    payload: schemas.MemberUpdate,
    db: Session = Depends(get_db),
    m: CurrentMember = Depends(require_member),
) -> schemas.MemberRead:
    row = members_service.get_member_by_email(db, m.email)
    updated = members_service.update_member_profile(
        db, member_id=cast(int, row.id), data=payload
    )
    return schemas.MemberRead.model_validate(updated)
