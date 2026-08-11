from __future__ import annotations

from collections.abc import Sequence
from typing import cast

from sqlalchemy.ext.asyncio import AsyncSession

from .. import models, schemas
from ..errors import ApiError
from ..post_owner_schemas import PostOwnerUpdate
from ..post_visibility import BOARD_POST_CATEGORIES
from ..repositories import members as members_repo
from ..repositories import posts as posts_repo
from . import upload_service


def _require_board_category(category: str) -> str:
    if category not in BOARD_POST_CATEGORIES:
        allowed = ", ".join(sorted(BOARD_POST_CATEGORIES))
        raise ApiError(
            code="invalid_post_category",
            detail=f"member posts must use one of: {allowed}",
            status=422,
        )
    return category


def _post_image_paths(
    cover_image: str | None,
    images: list[str] | None,
) -> set[str]:
    return upload_service.collect_managed_image_paths(
        cover_image=cover_image,
        images=images,
    )


def _payload_image_paths(
    current: models.Post,
    payload: schemas.PostUpdate,
) -> tuple[set[str], set[str]]:
    old_paths = _post_image_paths(
        cast(str | None, current.cover_image),
        cast(list[str] | None, current.images),
    )
    new_cover = (
        payload.cover_image
        if "cover_image" in payload.model_fields_set
        else cast(str | None, current.cover_image)
    )
    new_images = (
        payload.images
        if "images" in payload.model_fields_set
        else cast(list[str] | None, current.images)
    )
    new_paths = _post_image_paths(new_cover, new_images)
    return old_paths, new_paths


async def _validate_create_attach_paths(
    db: AsyncSession,
    *,
    actor_member_id: int,
    payload: schemas.PostCreate,
) -> None:
    paths = _post_image_paths(payload.cover_image, payload.images)
    await upload_service.validate_actor_owns_attach_paths(
        db, actor_member_id=actor_member_id, attach_paths=paths
    )


async def _update_post_with_image_lifecycle(
    db: AsyncSession,
    *,
    actor_member_id: int,
    post_id: int,
    current: models.Post,
    payload: schemas.PostUpdate,
) -> models.Post:
    old_paths, new_paths = _payload_image_paths(current, payload)
    updated_holder: list[models.Post] = []

    async def apply_update() -> None:
        updated_holder.append(
            await posts_repo.apply_post_update(db, post_id, payload)
        )

    await upload_service.apply_resource_image_lifecycle(
        db,
        upload_service.ResourceImageTransition(
            actor_member_id=actor_member_id,
            old_paths=old_paths,
            new_paths=new_paths,
            exclude_post_id=post_id,
        ),
        apply_update,
    )
    return updated_holder[0]


async def list_posts(
    db: AsyncSession,
    *,
    limit: int,
    offset: int,
    filters: posts_repo.PublicPostFilters | None = None,
) -> Sequence[models.Post]:
    return await posts_repo.list_posts(
        db,
        limit=limit,
        offset=offset,
        filters=filters,
    )


async def get_post(db: AsyncSession, post_id: int) -> models.Post:
    return await posts_repo.get_post(db, post_id)


async def get_public_post(db: AsyncSession, post_id: int) -> models.Post:
    return await posts_repo.get_public_post(db, post_id)


async def create_post(db: AsyncSession, payload: schemas.PostCreate) -> models.Post:
    if payload.author_id is None:
        raise ApiError(
            code="post_author_required",
            detail="author_id is required",
            status=422,
        )
    _ = await members_repo.get_member(db, payload.author_id)  # NotFoundError
    await _validate_create_attach_paths(
        db, actor_member_id=payload.author_id, payload=payload
    )
    return await posts_repo.create_post(db, payload)


async def create_admin_post(
    db: AsyncSession,
    payload: schemas.PostCreate,
    *,
    admin_student_id: str,
    actor_member_id: int | None = None,
) -> models.Post:
    """관리자가 글을 작성할 때 사용.

    보안: 클라이언트가 보낸 author_id를 무시하고 admin_student_id로 member를 조회하여
    author_id를 서버에서 강제 설정. pinned, published_at 등 관리자 권한 필드는 유지.
    """
    member = await members_repo.get_member_by_student_id(db, admin_student_id)
    actor_id = actor_member_id if actor_member_id is not None else cast(int, member.id)
    await _validate_create_attach_paths(db, actor_member_id=actor_id, payload=payload)
    sanitized = payload.model_copy(update={"author_id": member.id})
    return await posts_repo.create_post(db, sanitized)


async def create_member_post(
    db: AsyncSession,
    payload: schemas.PostCreate,
    *,
    member_student_id: str,
    member_id: int | None = None,
) -> models.Post:
    """일반 회원이 글을 작성할 때 사용.

    보안: author_id 강제 주입 + pinned/published_at 비활성화.
    """
    _require_board_category(payload.category)
    author_id = member_id
    if author_id is None:
        member = await members_repo.get_member_by_student_id(db, member_student_id)
        author_id = member.id
    await _validate_create_attach_paths(
        db, actor_member_id=cast(int, author_id), payload=payload
    )
    sanitized = payload.model_copy(
        update={
            "author_id": author_id,
            "pinned": False,
            "published_at": None,
        }
    )
    return await posts_repo.create_post(db, sanitized)


async def update_admin_post(
    db: AsyncSession,
    post_id: int,
    payload: schemas.PostUpdate,
    *,
    actor_member_id: int,
) -> models.Post:
    """관리자가 게시물을 수정할 때 사용."""
    current = await posts_repo.get_post(db, post_id)
    if "category" in payload.model_fields_set:
        current_is_board = current.category in BOARD_POST_CATEGORIES
        next_is_board = payload.category in BOARD_POST_CATEGORIES
        if current_is_board != next_is_board:
            raise ApiError(
                code="board_category_immutable",
                detail=(
                    "post category cannot cross board and published visibility "
                    "boundaries"
                ),
                status=422,
            )
    return await _update_post_with_image_lifecycle(
        db,
        actor_member_id=actor_member_id,
        post_id=post_id,
        current=current,
        payload=payload,
    )


def _require_member_board_owner(post: models.Post, member_id: int) -> None:
    """회원 mutation 대상이 본인 소유의 board 글인지 확인한다."""
    author_id = cast(int, post.author_id)
    if author_id != member_id:
        raise ApiError(
            code="post_owner_required",
            detail="only the author can modify board posts",
            status=403,
        )


async def update_member_post(
    db: AsyncSession,
    post_id: int,
    payload: PostOwnerUpdate,
    *,
    member_id: int,
) -> models.Post:
    """회원이 자기 board 게시글의 본문 필드만 수정한다."""
    post = await posts_repo.get_board_post(db, post_id)
    _require_member_board_owner(post, member_id)
    admin_payload = schemas.PostUpdate(
        **payload.model_dump(exclude_unset=True),
    )
    return await _update_post_with_image_lifecycle(
        db,
        actor_member_id=member_id,
        post_id=post_id,
        current=post,
        payload=admin_payload,
    )


async def delete_member_post(
    db: AsyncSession,
    post_id: int,
    *,
    member_id: int,
) -> int:
    """회원이 자기 board 게시글만 삭제한다."""
    post = await posts_repo.get_board_post(db, post_id)
    _require_member_board_owner(post, member_id)
    return await posts_repo.delete_post(db, post_id)


async def delete_admin_post(db: AsyncSession, post_id: int) -> int:
    """관리자가 게시물을 삭제할 때 사용. 삭제된 게시물 ID를 반환."""
    return await posts_repo.delete_post(db, post_id)


async def list_admin_posts_with_total(
    db: AsyncSession,
    *,
    limit: int,
    offset: int,
    filters: posts_repo.AdminPostFilters | None = None,
) -> tuple[Sequence[models.Post], int]:
    """관리자용 게시물 목록 + 총 개수를 반환."""
    posts = await posts_repo.list_admin_posts(
        db, limit=limit, offset=offset, filters=filters
    )
    total = await posts_repo.count_posts(db, filters=filters)
    return posts, total
