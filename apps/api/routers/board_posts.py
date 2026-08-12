"""회원 board 게시글 mutation API."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from .. import schemas
from ..db import get_db
from ..errors import ApiError
from ..post_owner_schemas import PostOwnerUpdate
from ..services import posts_service
from .auth import CurrentMember, require_member

router = APIRouter(prefix="/board/posts", tags=["board-posts"])


def _member_id(member: CurrentMember) -> int:
    if member.id is None:
        raise ApiError(
            code="member_id_missing",
            detail="member_id_missing",
            status=500,
        )
    return member.id


@router.patch("/{post_id}", response_model=schemas.PostRead)
async def update_board_post(
    post_id: int,
    payload: PostOwnerUpdate,
    db: AsyncSession = Depends(get_db),
    member: CurrentMember = Depends(require_member),
) -> schemas.PostRead:
    """작성자 본인의 board 게시글을 수정한다."""
    post = await posts_service.update_member_post(
        db,
        post_id,
        payload,
        member_id=_member_id(member),
    )
    return await posts_service.post_read_after_mutation(db, post)


@router.delete("/{post_id}")
async def delete_board_post(
    post_id: int,
    db: AsyncSession = Depends(get_db),
    member: CurrentMember = Depends(require_member),
) -> dict[str, bool | int]:
    """작성자 본인의 board 게시글을 삭제한다."""
    deleted_id = await posts_service.delete_member_post(
        db,
        post_id,
        member_id=_member_id(member),
    )
    return {"ok": True, "deleted_id": deleted_id}
