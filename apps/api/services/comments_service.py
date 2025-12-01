"""댓글 서비스 레이어"""
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from .. import schemas
from ..models import Comment
from ..repositories import comments as comments_repo


async def list_comments_by_post(db: AsyncSession, post_id: int) -> list[Comment]:
    """게시글의 댓글 목록 조회"""
    return await comments_repo.list_comments_by_post(db, post_id)


async def create_comment(
    db: AsyncSession, payload: schemas.CommentCreate, author_id: int
) -> Comment:
    """댓글 생성"""
    comment = Comment(
        post_id=payload.post_id,
        author_id=author_id,
        content=payload.content,
    )
    return await comments_repo.create_comment(db, comment)


async def delete_comment(
    db: AsyncSession, comment_id: int, requester_id: int, is_admin: bool
) -> None:
    """댓글 삭제 (본인 또는 관리자만 가능)"""
    comment = await comments_repo.get_comment(db, comment_id)
    if comment is None:
        raise HTTPException(status_code=404, detail="comment_not_found")

    # 권한 체크: 본인이거나 관리자만 삭제 가능
    if is_admin:
        # 관리자는 모든 댓글 삭제 가능
        await comments_repo.delete_comment(db, comment)
        return

    # 일반 회원: 본인 댓글만 삭제 가능
    # SQLAlchemy Column 비교를 명시적으로 bool로 변환
    if bool(comment.author_id != requester_id):
        raise HTTPException(status_code=403, detail="forbidden")

    await comments_repo.delete_comment(db, comment)
