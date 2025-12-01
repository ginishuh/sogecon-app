"""댓글 리포지토리"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models import Comment


async def list_comments_by_post(db: AsyncSession, post_id: int) -> list[Comment]:
    """특정 게시글의 댓글 목록 조회 (최신순)"""
    stmt = (
        select(Comment)
        .options(selectinload(Comment.author))
        .where(Comment.post_id == post_id)
        .order_by(Comment.created_at.desc())
    )
    result = await db.scalars(stmt)
    return list(result.all())


async def create_comment(db: AsyncSession, comment: Comment) -> Comment:
    """댓글 생성"""
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return comment


async def get_comment(db: AsyncSession, comment_id: int) -> Comment | None:
    """댓글 조회"""
    return await db.get(Comment, comment_id)


async def delete_comment(db: AsyncSession, comment: Comment) -> None:
    """댓글 삭제"""
    await db.delete(comment)
    await db.commit()
