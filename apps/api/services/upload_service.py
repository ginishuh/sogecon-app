"""Upload orchestration: quota, filesystem, and DB lifecycle."""

from __future__ import annotations

import re
import secrets
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from pathlib import Path
from typing import cast

from fastapi import UploadFile
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..bounded_reader import read_bounded_upload
from ..config import get_settings
from ..errors import ApiError
from ..media_utils import normalize_media_path
from ..models_upload import UploadAsset
from ..repositories import members as members_repo
from ..repositories import upload_assets as upload_assets_repo
from ..repositories import upload_references as upload_references_repo
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


def collect_managed_image_paths(
    *,
    cover_image: str | None = None,
    images: list[str] | None = None,
    image_override: str | None = None,
) -> set[str]:
    """Return managed upload paths (images/{safe_filename}) from media fields."""
    paths: set[str] = set()
    values: list[str | None] = [cover_image, image_override]
    if images:
        values.extend(images)
    for value in values:
        if not value:
            continue
        relative_path = normalize_media_path(value)
        if relative_path is None or not relative_path.startswith("images/"):
            continue
        filename = relative_path.rsplit("/", 1)[-1]
        if _SAFE_IMAGE_FILENAME.match(filename):
            paths.add(relative_path)
    return paths


async def validate_actor_owns_attach_paths(
    db: AsyncSession,
    *,
    actor_member_id: int,
    attach_paths: set[str],
) -> None:
    for relative_path in attach_paths:
        asset = await upload_assets_repo.get_image_asset_by_path(
            db, relative_path=relative_path
        )
        if asset is None:
            raise ApiError(
                code="upload_asset_not_found",
                detail="첨부할 수 없는 이미지입니다.",
                status=422,
            )
        owner_id = cast(int, asset.owner_member_id)
        if owner_id != actor_member_id:
            raise ApiError(
                code="upload_asset_forbidden",
                detail="다른 사용자의 이미지는 첨부할 수 없습니다.",
                status=403,
            )


async def compute_deletable_image_paths(
    db: AsyncSession,
    *,
    candidate_paths: set[str],
    exclude_post_id: int | None = None,
    exclude_hero_id: int | None = None,
) -> set[str]:
    deletable: set[str] = set()
    for relative_path in candidate_paths:
        referenced = await upload_references_repo.is_managed_path_referenced(
            db,
            relative_path,
            exclude_post_id=exclude_post_id,
            exclude_hero_id=exclude_hero_id,
        )
        if not referenced:
            deletable.add(relative_path)
    return deletable


@dataclass(frozen=True)
class ResourceImageTransition:
    actor_member_id: int
    old_paths: set[str]
    new_paths: set[str]
    exclude_post_id: int | None = None
    exclude_hero_id: int | None = None


def _media_file_path(relative_path: str) -> Path:
    media_root = Path(get_settings().media_root)
    return media_root / relative_path


def _tombstone_managed_file(relative_path: str) -> tuple[Path, Path]:
    file_path = _media_file_path(relative_path)
    if not file_path.exists():
        return file_path, file_path
    tombstone = file_path.with_name(
        f".delete_{secrets.token_hex(8)}_{file_path.name}"
    )
    file_path.rename(tombstone)
    return file_path, tombstone


def _restore_tombstone(file_path: Path, tombstone: Path) -> None:
    if tombstone == file_path:
        return
    if tombstone.exists() and not file_path.exists():
        tombstone.rename(file_path)


def _unlink_tombstone(file_path: Path, tombstone: Path) -> None:
    if tombstone == file_path:
        return
    try:
        tombstone.unlink()
    except OSError:
        pass


async def apply_resource_image_lifecycle(
    db: AsyncSession,
    transition: ResourceImageTransition,
    apply_resource_update: Callable[[], Awaitable[None]],
) -> None:
    """Validate attach ownership and atomically update resource + asset cleanup."""
    attach_paths = transition.new_paths - transition.old_paths
    await validate_actor_owns_attach_paths(
        db,
        actor_member_id=transition.actor_member_id,
        attach_paths=attach_paths,
    )
    paths_to_delete = await compute_deletable_image_paths(
        db,
        candidate_paths=transition.old_paths - transition.new_paths,
        exclude_post_id=transition.exclude_post_id,
        exclude_hero_id=transition.exclude_hero_id,
    )

    tombstones: list[tuple[Path, Path]] = []
    try:
        for relative_path in paths_to_delete:
            tombstones.append(_tombstone_managed_file(relative_path))

        await apply_resource_update()

        for relative_path in paths_to_delete:
            asset = await upload_assets_repo.get_image_asset_by_path(
                db, relative_path=relative_path
            )
            if asset is not None:
                await upload_assets_repo.delete_asset(db, asset)

        await db.commit()
    except (OSError, SQLAlchemyError, ApiError):
        await db.rollback()
        for file_path, tombstone in reversed(tombstones):
            _restore_tombstone(file_path, tombstone)
        raise
    else:
        for file_path, tombstone in tombstones:
            _unlink_tombstone(file_path, tombstone)


async def _delete_image_asset(db: AsyncSession, asset: UploadAsset) -> None:
    settings = get_settings()
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


async def delete_post_image(
    db: AsyncSession,
    *,
    member_id: int,
    filename: str,
) -> None:
    """Delete an owned staged post image. Idempotent when already removed."""
    _validate_image_filename(filename)
    await upload_assets_repo.lock_member(db, member_id)
    asset = await upload_assets_repo.get_image_asset_by_filename(
        db, member_id=member_id, filename=filename
    )
    if asset is None:
        return
    relative_path = str(asset.path)
    referenced = await upload_references_repo.is_managed_path_referenced(
        db, relative_path
    )
    if referenced:
        raise ApiError(
            code="upload_asset_in_use",
            detail="다른 게시물이나 히어로에서 사용 중인 이미지는 삭제할 수 없습니다.",
            status=409,
        )
    await _delete_image_asset(db, asset)


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
