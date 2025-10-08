from __future__ import annotations

from typing import cast

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from .. import schemas
from ..db import get_db
from ..services import members_service
from .auth import CurrentMember, require_member

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


@router.post("/avatar", response_model=schemas.MemberRead)
async def upload_avatar(
    avatar: UploadFile = File(...),
    db: Session = Depends(get_db),
    m: CurrentMember = Depends(require_member),
) -> schemas.MemberRead:
    row = members_service.get_member_by_email(db, m.email)
    file_bytes = await avatar.read()
    await avatar.close()
    updated = members_service.update_member_avatar(
        db,
        member_id=cast(int, row.id),
        file_bytes=file_bytes,
        filename_hint=avatar.filename,
    )
    return schemas.MemberRead.model_validate(updated)
