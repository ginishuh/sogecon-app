"""댓글 서비스 레이어"""
from fastapi import HTTPException
from sqlalchemy.orm import Session

from .. import schemas
from ..models import Comment
from ..repositories import comments as comments_repo


def list_comments_by_post(db: Session, post_id: int) -> list[Comment]:
    """게시글의 댓글 목록 조회"""
    return comments_repo.list_comments_by_post(db, post_id)


def create_comment(
    db: Session, payload: schemas.CommentCreate, author_id: int
) -> Comment:
    """댓글 생성"""
    comment = Comment(
        post_id=payload.post_id,
        author_id=author_id,
        content=payload.content,
    )
    return comments_repo.create_comment(db, comment)


def delete_comment(
    db: Session, comment_id: int, requester_id: int, is_admin: bool
) -> None:
    """댓글 삭제 (본인 또는 관리자만 가능)"""
    comment = comments_repo.get_comment(db, comment_id)
    if comment is None:
        raise HTTPException(status_code=404, detail="comment_not_found")

    # 권한 체크: 본인이거나 관리자만 삭제 가능
    # pyright가 SQLAlchemy ORM 속성을 Column으로 인식하는 문제 회피
    comment_author_id = getattr(comment, "author_id", None)
    if not is_admin and comment_author_id != requester_id:
        raise HTTPException(status_code=403, detail="forbidden")

    comments_repo.delete_comment(db, comment)
