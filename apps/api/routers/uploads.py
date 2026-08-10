"""이미지 업로드 라우터."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, UploadFile
from pydantic import BaseModel
from slowapi import Limiter
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status as http_status

from ..config import get_settings
from ..db import get_db
from ..ratelimit import (
    consume_limit,
    get_client_ip_for_rate_limit,
    get_member_id_for_rate_limit,
)
from ..services import upload_service
from .auth import CurrentMember, require_member

router = APIRouter(prefix="/uploads", tags=["uploads"])
limiter_ip = Limiter(key_func=get_client_ip_for_rate_limit)
limiter_member = Limiter(key_func=get_member_id_for_rate_limit)


def _member_id(member: CurrentMember) -> int:
    if member.id is None:
        raise RuntimeError("member_id_missing")
    return member.id


class ImageUploadResponse(BaseModel):
    """이미지 업로드 응답."""

    url: str
    filename: str


def _apply_upload_rate_limits(
    request: Request, member: CurrentMember, *, limit_value: str
) -> None:
    request.state.rate_limit_member_id = _member_id(member)
    consume_limit(limiter_ip, request, limit_value)
    consume_limit(limiter_member, request, limit_value)


@router.post("/images", response_model=ImageUploadResponse)
async def upload_image(
    request: Request,
    file: UploadFile,
    member: CurrentMember = Depends(require_member),
    db: AsyncSession = Depends(get_db),
) -> ImageUploadResponse:
    """이미지 파일 업로드."""
    settings = get_settings()
    _apply_upload_rate_limits(
        request, member, limit_value=settings.rate_limit_image_upload
    )
    url, filename = await upload_service.upload_post_image(
        db, member_id=_member_id(member), upload=file
    )
    return ImageUploadResponse(url=url, filename=filename)


@router.delete("/images/{filename}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete_image(
    request: Request,
    filename: str,
    member: CurrentMember = Depends(require_member),
    db: AsyncSession = Depends(get_db),
) -> None:
    """본인 소유 업로드 이미지 삭제 (idempotent)."""
    settings = get_settings()
    _apply_upload_rate_limits(
        request, member, limit_value=settings.rate_limit_image_upload
    )
    await upload_service.delete_post_image(
        db, member_id=_member_id(member), filename=filename
    )
