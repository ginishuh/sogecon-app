"""댓글 서비스 레이어"""
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from .. import schemas
from ..models import Comment
from ..repositories import comments as comments_repo
from ..repositories import members as members_repo


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


async def create_comment_by_student_id(
    db: AsyncSession, payload: schemas.CommentCreate, student_id: str
) -> Comment:
    """student_id로 member 조회 후 댓글 생성.

    보안: 세션에 저장된 member.id가 아닌 student_id로 DB에서 직접 조회하여
    레거시 세션(admin_users.id가 저장된 경우)에서도 올바른 author_id 사용.
    """
    member = await members_repo.get_member_by_student_id(db, student_id)
    comment = Comment(
        post_id=payload.post_id,
        author_id=member.id,
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
