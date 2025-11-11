"""댓글 리포지토리"""
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..models import Comment


def list_comments_by_post(db: Session, post_id: int) -> list[Comment]:
    """특정 게시글의 댓글 목록 조회 (최신순)"""
    stmt = (
        select(Comment)
        .options(joinedload(Comment.author))
        .where(Comment.post_id == post_id)
        .order_by(Comment.created_at.desc())
    )
    return list(db.scalars(stmt).all())


def create_comment(db: Session, comment: Comment) -> Comment:
    """댓글 생성"""
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


def get_comment(db: Session, comment_id: int) -> Comment | None:
    """댓글 조회"""
    return db.get(Comment, comment_id)


def delete_comment(db: Session, comment: Comment) -> None:
    """댓글 삭제"""
    db.delete(comment)
    db.commit()
