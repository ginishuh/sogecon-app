from __future__ import annotations

from typing import cast

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status as http_status

from .. import schemas
from ..db import get_db
from ..services import members_service, profile_change_service
from .auth import CurrentMember, require_member

router = APIRouter(prefix="/me", tags=["me"])


@router.get("/", response_model=schemas.MemberRead)
async def get_me(
    db: AsyncSession = Depends(get_db), m: CurrentMember = Depends(require_member)
) -> schemas.MemberRead:
    row = await members_service.get_member_by_student_id(db, m.student_id)
    return schemas.MemberRead.model_validate(row)


@router.put("/", response_model=schemas.MemberRead)
async def update_me(
    payload: schemas.MemberUpdate,
    db: AsyncSession = Depends(get_db),
    m: CurrentMember = Depends(require_member),
) -> schemas.MemberRead:
    row = await members_service.get_member_by_student_id(db, m.student_id)
    updated = await members_service.update_member_profile(
        db, member_id=cast(int, row.id), data=payload
    )
    return schemas.MemberRead.model_validate(updated)


@router.post("/avatar", response_model=schemas.MemberRead)
async def upload_avatar(
    avatar: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    m: CurrentMember = Depends(require_member),
) -> schemas.MemberRead:
    row = await members_service.get_member_by_student_id(db, m.student_id)
    file_bytes = await avatar.read()
    await avatar.close()
    updated = await members_service.update_member_avatar(
        db,
        member_id=cast(int, row.id),
        file_bytes=file_bytes,
        filename_hint=avatar.filename,
    )
    return schemas.MemberRead.model_validate(updated)


@router.post(
    "/change-requests",
    response_model=schemas.ProfileChangeRequestRead,
    status_code=http_status.HTTP_201_CREATED,
)
async def create_change_request(
    payload: schemas.ProfileChangeRequestCreate,
    db: AsyncSession = Depends(get_db),
    m: CurrentMember = Depends(require_member),
) -> schemas.ProfileChangeRequestRead:
    member = await members_service.get_member_by_student_id(db, m.student_id)
    row = await profile_change_service.create_change_request(
        db, member=member, data=payload
    )
    return schemas.ProfileChangeRequestRead.model_validate(row)


@router.get(
    "/change-requests",
    response_model=list[schemas.ProfileChangeRequestRead],
)
async def list_my_change_requests(
    db: AsyncSession = Depends(get_db),
    m: CurrentMember = Depends(require_member),
) -> list[schemas.ProfileChangeRequestRead]:
    if m.id is not None:
        member_id = m.id
    else:
        member = await members_service.get_member_by_student_id(db, m.student_id)
        member_id = cast(int, member.id)
    rows = await profile_change_service.list_my_requests(db, member_id)
    return [schemas.ProfileChangeRequestRead.model_validate(r) for r in rows]
