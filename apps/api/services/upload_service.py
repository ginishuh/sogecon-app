"""Upload orchestration: quota, filesystem, and DB lifecycle."""

from __future__ import annotations

import re
import secrets
import time
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..bounded_reader import read_bounded_upload
from ..config import get_settings
from ..errors import ApiError
from ..repositories import members as members_repo
from ..repositories import upload_assets as upload_assets_repo
from . import image_pipeline

_SAFE_IMAGE_FILENAME = re.compile(
    r"^\d+_[a-f0-9]{16}\.(jpg|jpeg|png|webp|gif)$",
    re.IGNORECASE,
)


def _generate_filename(extension: str) -> str:
    timestamp = int(time.time())
    random_hex = secrets.token_hex(8)
    return f"{timestamp}_{random_hex}{extension}"


def _validate_image_filename(filename: str) -> None:
    if not _SAFE_IMAGE_FILENAME.match(filename):
        raise ApiError(
            code="invalid_upload_filename",
            detail="유효하지 않은 파일명입니다.",
            status=422,
        )


async def upload_post_image(
    db: AsyncSession,
    *,
    member_id: int,
    upload: UploadFile,
) -> tuple[str, str]:
    """Upload a post image. Returns (url, filename)."""
    settings = get_settings()
    pipeline_config = image_pipeline.post_image_config(
        max_pixels=settings.image_max_pixels,
        decode_max_pixels=settings.image_decode_max_pixels,
    )
    ext = image_pipeline.validate_mime_and_extension(
        content_type=upload.content_type or "",
        filename=upload.filename or "image.jpg",
        config=pipeline_config,
        invalid_type_code="invalid_image_type",
        invalid_extension_code="invalid_image_extension",
    )
    raw_bytes = await read_bounded_upload(
        upload,
        max_bytes=settings.image_max_upload_bytes,
        oversize_code="image_too_large",
        empty_code="image_empty",
    )
    processed = image_pipeline.process_image_bytes(
        raw_bytes,
        ext,
        config=pipeline_config,
        errors=image_pipeline.ImageProcessErrorCodes(
            invalid_data="invalid_image_data",
            unsupported_format="invalid_image_format",
            decode_too_large="image_decode_too_large",
        ),
    )

    media_root = Path(settings.media_root)
    storage_dir = media_root / processed.relative_subdir
    storage_dir.mkdir(parents=True, exist_ok=True)
    new_filename = _generate_filename(processed.extension)
    relative_path = f"{processed.relative_subdir}/{new_filename}"
    file_path = storage_dir / new_filename

    await upload_assets_repo.lock_member(db, member_id)
    count, total_bytes = await upload_assets_repo.get_image_quota_usage(
        db, member_id=member_id
    )
    if count >= settings.image_quota_count:
        raise ApiError(
            code="image_quota_count_exceeded",
            detail="업로드 가능한 이미지 개수를 초과했습니다.",
            status=409,
        )
    if total_bytes + len(processed.data) > settings.image_quota_bytes:
        raise ApiError(
            code="image_quota_bytes_exceeded",
            detail="업로드 가능한 이미지 용량을 초과했습니다.",
            status=409,
        )

    try:
        file_path.write_bytes(processed.data)
        await upload_assets_repo.create_asset(
            db,
            owner_member_id=member_id,
            kind="image",
            path=relative_path,
            size_bytes=len(processed.data),
        )
        await db.commit()
    except (OSError, SQLAlchemyError):
        await db.rollback()
        try:
            file_path.unlink()
        except FileNotFoundError:
            pass
        raise

    url = f"{settings.media_url_base}/{relative_path}"
    return url, new_filename


async def delete_post_image(
    db: AsyncSession,
    *,
    member_id: int,
    filename: str,
) -> None:
    """Delete an owned post image. Idempotent when already removed."""
    _validate_image_filename(filename)
    settings = get_settings()
    asset = await upload_assets_repo.get_image_asset_by_filename(
        db, member_id=member_id, filename=filename
    )
    if asset is None:
        return

    media_root = Path(settings.media_root)
    file_path = media_root / str(asset.path)
    tombstone: Path | None = None
    if file_path.exists():
        tombstone = file_path.with_name(
            f".delete_{secrets.token_hex(8)}_{file_path.name}"
        )
        file_path.rename(tombstone)

    try:
        await upload_assets_repo.delete_asset(db, asset)
        await db.commit()
    except SQLAlchemyError:
        await db.rollback()
        if tombstone is not None and tombstone.exists() and not file_path.exists():
            tombstone.rename(file_path)
        raise

    if tombstone is not None:
        try:
            tombstone.unlink()
        except OSError:
            pass


async def upload_member_avatar(
    db: AsyncSession,
    *,
    member_id: int,
    upload: UploadFile,
) -> models.Member:
    """Upload and persist a member avatar. Returns updated Member."""
    settings = get_settings()
    pipeline_config = image_pipeline.avatar_image_config(
        max_pixels=settings.avatar_max_pixels,
        decode_max_pixels=settings.avatar_decode_max_pixels,
        max_output_bytes=settings.avatar_max_bytes,
    )
    image_pipeline.validate_mime_and_extension(
        content_type=upload.content_type or "",
        filename=upload.filename or "avatar.jpg",
        config=pipeline_config,
        invalid_type_code="avatar_unsupported_format",
        invalid_extension_code="avatar_unsupported_format",
    )
    raw_bytes = await read_bounded_upload(
        upload,
        max_bytes=settings.avatar_max_upload_bytes,
        oversize_code="avatar_too_large",
        empty_code="avatar_empty",
    )
    processed = image_pipeline.process_image_bytes(
        raw_bytes,
        ".jpg",
        config=pipeline_config,
        errors=image_pipeline.ImageProcessErrorCodes(
            invalid_data="avatar_invalid_image",
            unsupported_format="avatar_unsupported_format",
            decode_too_large="avatar_decode_too_large",
            compress_failed="avatar_compress_failed",
        ),
    )

    media_root = Path(settings.media_root)
    storage_dir = media_root / processed.relative_subdir
    storage_dir.mkdir(parents=True, exist_ok=True)
    new_filename = (
        f"member_{member_id}_{int(time.time())}_{secrets.token_hex(4)}.jpg"
    )
    relative_path = f"{processed.relative_subdir}/{new_filename}"
    file_path = storage_dir / new_filename

    member = await members_repo.get_member(db, member_id)
    previous_path = getattr(member, "avatar_path", None)

    try:
        file_path.write_bytes(processed.data)
        setattr(member, "avatar_path", relative_path)
        await db.commit()
        await db.refresh(member)
    except (OSError, SQLAlchemyError):
        await db.rollback()
        try:
            file_path.unlink()
        except FileNotFoundError:
            pass
        raise

    if previous_path:
        old_file = media_root / previous_path
        try:
            old_file.unlink()
        except FileNotFoundError:
            pass

    return member
