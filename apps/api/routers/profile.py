from __future__ import annotations

from typing import cast

from fastapi import APIRouter, Depends, File, Request, UploadFile
from slowapi import Limiter
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status as http_status

from .. import schemas
from ..config import get_settings
from ..db import get_db
from ..directory_schemas import DirectoryConsentWrite, DirectoryViewRequestRead
from ..ratelimit import (
    consume_limit,
    get_client_ip_for_rate_limit,
    get_member_id_for_rate_limit,
)
from ..services import (
    directory_view_request_service,
    members_service,
    profile_change_service,
    upload_service,
)
from .auth import CurrentMember, require_member

router = APIRouter(prefix="/me", tags=["me"])
limiter_ip = Limiter(key_func=get_client_ip_for_rate_limit)
limiter_member = Limiter(key_func=get_member_id_for_rate_limit)


@router.get("/", response_model=schemas.MemberRead)
async def get_me(
    db: AsyncSession = Depends(get_db), m: CurrentMember = Depends(require_member)
) -> schemas.MemberRead:
    row = await members_service.get_member_by_student_id(db, m.student_id)
    return schemas.MemberRead.model_validate(row)


@router.post("/directory-consent", response_model=schemas.MemberRead)
async def submit_directory_consent(
    payload: DirectoryConsentWrite,
    db: AsyncSession = Depends(get_db),
    m: CurrentMember = Depends(require_member),
) -> schemas.MemberRead:
    member = await members_service.get_session_member(
        db, member_id=m.id, student_id=m.student_id
    )
    updated = await members_service.submit_directory_consent(
        db, member_id=int(cast(int, member.id)), visibility=payload.visibility
    )
    return schemas.MemberRead.model_validate(updated)


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
    request: Request,
    avatar: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    m: CurrentMember = Depends(require_member),
) -> schemas.MemberRead:
    row = await members_service.get_member_by_student_id(db, m.student_id)
    settings = get_settings()
    request.state.rate_limit_member_id = row.id
    consume_limit(limiter_ip, request, settings.rate_limit_avatar_upload)
    consume_limit(limiter_member, request, settings.rate_limit_avatar_upload)
    updated = await upload_service.upload_member_avatar(
        db,
        member_id=cast(int, row.id),
        upload=avatar,
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


@router.get(
    "/view-requests",
    response_model=list[DirectoryViewRequestRead],
)
async def list_incoming_view_requests(
    db: AsyncSession = Depends(get_db),
    m: CurrentMember = Depends(require_member),
) -> list[DirectoryViewRequestRead]:
    member = await members_service.get_session_member(
        db, member_id=m.id, student_id=m.student_id
    )
    rows = await directory_view_request_service.list_incoming_requests(
        db, target_id=int(cast(int, member.id))
    )
    return list(rows)


@router.post(
    "/view-requests/{request_id}/accept",
    response_model=DirectoryViewRequestRead,
)
async def accept_view_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    m: CurrentMember = Depends(require_member),
) -> DirectoryViewRequestRead:
    member = await members_service.get_session_member(
        db, member_id=m.id, student_id=m.student_id
    )
    return await directory_view_request_service.decide_view_request(
        db, target=member, request_id=request_id, decision="accepted"
    )


@router.post(
    "/view-requests/{request_id}/decline",
    response_model=DirectoryViewRequestRead,
)
async def decline_view_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    m: CurrentMember = Depends(require_member),
) -> DirectoryViewRequestRead:
    member = await members_service.get_session_member(
        db, member_id=m.id, student_id=m.student_id
    )
    return await directory_view_request_service.decide_view_request(
        db, target=member, request_id=request_id, decision="declined"
    )


@router.post(
    "/view-requests/{request_id}/revoke",
    response_model=DirectoryViewRequestRead,
)
async def revoke_view_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    m: CurrentMember = Depends(require_member),
) -> DirectoryViewRequestRead:
    member = await members_service.get_session_member(
        db, member_id=m.id, student_id=m.student_id
    )
    return await directory_view_request_service.revoke_view_request(
        db, target=member, request_id=request_id
    )
