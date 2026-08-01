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


def _require_board_category(category: str) -> str:
    if category not in BOARD_POST_CATEGORIES:
        allowed = ", ".join(sorted(BOARD_POST_CATEGORIES))
        raise ApiError(
            code="invalid_post_category",
            detail=f"member posts must use one of: {allowed}",
            status=422,
        )
    return category


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
    return await posts_repo.create_post(db, payload)


async def create_admin_post(
    db: AsyncSession,
    payload: schemas.PostCreate,
    *,
    admin_student_id: str,
) -> models.Post:
    """관리자가 글을 작성할 때 사용.

    보안: 클라이언트가 보낸 author_id를 무시하고 admin_student_id로 member를 조회하여
    author_id를 서버에서 강제 설정. pinned, published_at 등 관리자 권한 필드는 유지.
    """
    member = await members_repo.get_member_by_student_id(db, admin_student_id)
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
) -> models.Post:
    """관리자가 게시물을 수정할 때 사용."""
    if "category" in payload.model_fields_set:
        current = await posts_repo.get_post(db, post_id)
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
    return await posts_repo.update_post(db, post_id, payload)


def _require_member_board_owner(post: models.Post, member_id: int) -> None:
    """회원 mutation 대상이 본인 소유의 board 글인지 확인한다."""
    author_id = cast(int, post.author_id)
    category = cast(str | None, post.category)
    if author_id != member_id or category not in BOARD_POST_CATEGORIES:
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
    post = await posts_repo.get_post(db, post_id)
    _require_member_board_owner(post, member_id)
    admin_payload = schemas.PostUpdate(
        **payload.model_dump(exclude_unset=True),
    )
    return await posts_repo.update_post(db, post_id, admin_payload)


async def delete_member_post(
    db: AsyncSession,
    post_id: int,
    *,
    member_id: int,
) -> int:
    """회원이 자기 board 게시글만 삭제한다."""
    post = await posts_repo.get_post(db, post_id)
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
