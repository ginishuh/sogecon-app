from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..models_upload import UploadAsset


async def lock_member(db: AsyncSession, member_id: int) -> models.Member:
    stmt = (
        select(models.Member)
        .where(models.Member.id == member_id)
        .with_for_update()
    )
    result = await db.execute(stmt)
    member = result.scalar_one()
    return member


async def get_image_quota_usage(
    db: AsyncSession, *, member_id: int
) -> tuple[int, int]:
    stmt = (
        select(
            func.count(UploadAsset.id),
            func.coalesce(func.sum(UploadAsset.size_bytes), 0),
        )
        .where(
            UploadAsset.owner_member_id == member_id,
            UploadAsset.kind == "image",
        )
    )
    result = await db.execute(stmt)
    count, total_bytes = result.one()
    return int(count), int(total_bytes)


async def create_asset(
    db: AsyncSession,
    *,
    owner_member_id: int,
    kind: str,
    path: str,
    size_bytes: int,
) -> UploadAsset:
    asset = UploadAsset(
        owner_member_id=owner_member_id,
        kind=kind,
        path=path,
        size_bytes=size_bytes,
    )
    db.add(asset)
    await db.flush()
    return asset


async def get_image_asset_by_filename(
    db: AsyncSession, *, member_id: int, filename: str
) -> UploadAsset | None:
    relative_path = f"images/{filename}"
    stmt = select(UploadAsset).where(
        UploadAsset.owner_member_id == member_id,
        UploadAsset.kind == "image",
        UploadAsset.path == relative_path,
    )
    result = await db.execute(stmt)
    return result.scalars().first()


async def delete_asset(db: AsyncSession, asset: UploadAsset) -> None:
    await db.delete(asset)
