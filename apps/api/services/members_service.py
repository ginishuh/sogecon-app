from __future__ import annotations

import io
import secrets
import time
from collections import OrderedDict
from collections.abc import Sequence
from pathlib import Path
from typing import Never

from PIL import Image, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models, schemas
from ..config import get_settings
from ..errors import AlreadyExistsError, ApiError
from ..repositories import members as members_repo

_ALLOWED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP"}
_INITIAL_JPEG_QUALITY = 85
_MIN_JPEG_QUALITY = 50

_MEMBER_COUNT_CACHE_TTL = 30.0
_MEMBER_COUNT_CACHE_MAX = 64
_member_count_cache: OrderedDict[
    tuple[tuple[str, str], ...], tuple[float, int]
] = OrderedDict()


def _raise_member_conflict_from_integrity_error(exc: IntegrityError) -> Never:
    """members 유니크 제약 충돌을 안정적인 409 코드로 변환."""
    message = str(exc.orig).lower()
    if (
        "ix_members_phone" in message
        or "members.phone" in message
        or "key (phone)" in message
    ):
        raise AlreadyExistsError(
            code="member_phone_already_in_use",
            detail="Phone already in use",
        ) from exc
    if (
        "ix_members_email" in message
        or "members.email" in message
        or "key (email)" in message
    ):
        raise AlreadyExistsError(
            code="member_exists",
            detail="Email already in use",
        ) from exc
    if (
        "ix_members_student_id" in message
        or "members.student_id" in message
        or "key (student_id)" in message
    ):
        raise AlreadyExistsError(
            code="member_exists",
            detail="Student ID already in use",
        ) from exc
    raise exc


def _load_and_normalize_image(file_bytes: bytes) -> Image.Image:
    try:
        image = Image.open(io.BytesIO(file_bytes))
    except UnidentifiedImageError as exc:
        raise ApiError(
            code="avatar_invalid_image",
            detail="이미지 형식을 인식할 수 없습니다.",
            status=422,
        ) from exc

    if image.format not in _ALLOWED_IMAGE_FORMATS:
        raise ApiError(
            code="avatar_unsupported_format",
            detail="JPG, PNG, WEBP 형식만 업로드할 수 있습니다.",
            status=422,
        )

    image.load()
    if image.mode not in {"RGB", "L", "RGBA"}:
        image = image.convert("RGBA")
    if image.mode == "RGBA":
        background = Image.new("RGBA", image.size, (255, 255, 255, 255))
        background.paste(image, mask=image.split()[-1])
        return background.convert("RGB")
    if image.mode != "RGB":
        return image.convert("RGB")
    return image


def _compress_to_jpeg(
    image: Image.Image,
    *,
    max_pixels: int,
    max_bytes: int,
) -> bytes:
    normalized = image.copy()
    normalized.thumbnail((max_pixels, max_pixels))

    buffer = io.BytesIO()
    quality = _INITIAL_JPEG_QUALITY
    while True:
        buffer.seek(0)
        buffer.truncate(0)
        normalized.save(buffer, format="JPEG", optimize=True, quality=quality)
        if buffer.tell() <= max_bytes or quality <= _MIN_JPEG_QUALITY:
            break
        quality -= 5

    data = buffer.getvalue()
    if len(data) > max_bytes:
        raise ApiError(
            code="avatar_compress_failed",
            detail="이미지를 100KB 이하로 압축할 수 없습니다.",
            status=422,
        )
    return data


def _remove_previous_avatar(previous_path: str | None, media_root: Path) -> None:
    if not previous_path:
        return
    old_file = media_root / previous_path
    try:
        old_file.unlink()
    except FileNotFoundError:
        pass


async def list_members(
    db: AsyncSession,
    *,
    limit: int,
    offset: int,
    filters: schemas.MemberListFilters | None = None,
) -> Sequence[models.Member]:
    return await members_repo.list_members(
        db, limit=limit, offset=offset, filters=filters
    )


async def count_members(
    db: AsyncSession, *, filters: schemas.MemberListFilters | None = None
) -> int:
    def _normalize_value(value: object) -> str:
        if isinstance(value, bool):
            return "1" if value else "0"
        return str(value)

    key: tuple[tuple[str, str], ...]
    if not filters:
        key = tuple()
    else:
        items = [
            (k, _normalize_value(v))
            for k, v in filters.items()
            if v is not None
        ]
        items.sort()
        key = tuple(items)

    now = time.time()
    cached = _member_count_cache.get(key)
    if cached and (now - cached[0]) < _MEMBER_COUNT_CACHE_TTL:
        _member_count_cache.move_to_end(key, last=True)
        return cached[1]

    count = await members_repo.count_members(db, filters=filters)
    _member_count_cache[key] = (now, count)
    _member_count_cache.move_to_end(key, last=True)
    if len(_member_count_cache) > _MEMBER_COUNT_CACHE_MAX:
        _member_count_cache.popitem(last=False)
    return count


async def get_member(db: AsyncSession, member_id: int) -> models.Member:
    return await members_repo.get_member(db, member_id)


async def create_member(
    db: AsyncSession, payload: schemas.MemberCreate
) -> models.Member:
    # 이메일 중복 방지(사전 검사)
    stmt = select(models.Member).where(models.Member.email == payload.email)
    result = await db.execute(stmt)
    if result.scalars().first() is not None:
        raise AlreadyExistsError(code="member_exists", detail="Email already in use")
    phone = payload.phone.strip() if isinstance(payload.phone, str) else None
    normalized_phone = phone or None
    if isinstance(normalized_phone, str):
        stmt = select(models.Member.id).where(models.Member.phone == normalized_phone)
        phone_result = await db.execute(stmt)
        if phone_result.scalar_one_or_none() is not None:
            raise AlreadyExistsError(
                code="member_phone_already_in_use",
                detail="Phone already in use",
            )
    if normalized_phone != payload.phone:
        payload = payload.model_copy(update={"phone": normalized_phone})
    try:
        return await members_repo.create_member(db, payload)
    except IntegrityError as exc:
        await db.rollback()
        _raise_member_conflict_from_integrity_error(exc)


async def get_member_by_email(db: AsyncSession, email: str) -> models.Member:
    return await members_repo.get_member_by_email(db, email)


async def get_member_by_student_id(db: AsyncSession, student_id: str) -> models.Member:
    return await members_repo.get_member_by_student_id(db, student_id)


async def update_member_profile(
    db: AsyncSession, *, member_id: int, data: schemas.MemberUpdate
) -> models.Member:
    raw_payload = data.model_dump(exclude_unset=True)
    if not raw_payload:
        return await members_repo.update_member_profile(
            db, member_id=member_id, data=data
        )
    sanitized_data: dict[str, object] = {
        key: value.strip() if isinstance(value, str) else value
        for key, value in raw_payload.items()
    }
    phone_value = sanitized_data.get("phone")
    if isinstance(phone_value, str):
        normalized_phone = phone_value.strip() or None
        sanitized_data["phone"] = normalized_phone
        if isinstance(normalized_phone, str):
            stmt = select(models.Member.id).where(
                models.Member.phone == normalized_phone,
                models.Member.id != member_id,
            )
            result = await db.execute(stmt)
            if result.scalar_one_or_none() is not None:
                raise AlreadyExistsError(
                    code="member_phone_already_in_use",
                    detail="Phone already in use",
                )
    sanitized = data.model_copy(update=sanitized_data)
    try:
        return await members_repo.update_member_profile(
            db, member_id=member_id, data=sanitized
        )
    except IntegrityError as exc:
        await db.rollback()
        _raise_member_conflict_from_integrity_error(exc)


async def update_member_avatar(
    db: AsyncSession,
    *,
    member_id: int,
    file_bytes: bytes,
    filename_hint: str | None = None,
) -> models.Member:
    settings = get_settings()
    if not file_bytes:
        raise ApiError(
            code="avatar_empty",
            detail="이미지 파일이 비어 있습니다.",
            status=422,
        )
    if len(file_bytes) > settings.avatar_max_upload_bytes:
        raise ApiError(
            code="avatar_too_large_raw",
            detail="업로드 파일 크기가 허용 범위를 초과했습니다.",
            status=422,
        )
    image = _load_and_normalize_image(file_bytes)
    avatar_bytes = _compress_to_jpeg(
        image,
        max_pixels=settings.avatar_max_pixels,
        max_bytes=settings.avatar_max_bytes,
    )

    media_root = Path(settings.media_root)
    storage_dir = media_root / "avatars"
    storage_dir.mkdir(parents=True, exist_ok=True)

    suffix = Path(filename_hint or "avatar.jpg").suffix.lower() or ".jpg"
    if suffix not in {".jpg", ".jpeg"}:
        suffix = ".jpg"
    new_filename = (
        f"member_{member_id}_{int(time.time())}_{secrets.token_hex(4)}{suffix}"
    )
    relative_path = f"avatars/{new_filename}"
    file_path = storage_dir / new_filename
    file_path.write_bytes(avatar_bytes)

    member = await members_repo.get_member(db, member_id)
    previous_path = getattr(member, "avatar_path", None)
    setattr(member, "avatar_path", relative_path)
    await db.commit()
    await db.refresh(member)

    _remove_previous_avatar(previous_path, media_root)

    return member
