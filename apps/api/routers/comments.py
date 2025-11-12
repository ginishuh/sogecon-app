"""댓글 라우터"""
from http import HTTPStatus

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import schemas
from ..db import get_db
from ..services import comments_service
from .auth import require_admin, require_member

router = APIRouter(prefix="/comments", tags=["comments"])


@router.get("/", response_model=list[schemas.CommentRead])
def list_comments(
    post_id: int,
    db: Session = Depends(get_db),
) -> list[schemas.CommentRead]:
    """특정 게시글의 댓글 목록 조회"""
    comments = comments_service.list_comments_by_post(db, post_id)
    result: list[schemas.CommentRead] = []
    for comment in comments:
        comment_read = schemas.CommentRead.model_validate(comment)
        comment_read.author_name = comment.author.name if comment.author else None
        result.append(comment_read)
    return result


@router.post("/", response_model=schemas.CommentRead, status_code=201)
def create_comment(
    payload: schemas.CommentCreate,
    request: Request,
    db: Session = Depends(get_db),
) -> schemas.CommentRead:
    """댓글 작성 (회원 또는 관리자)"""
    # 관리자 또는 회원 체크
    author_id: int
    try:
        require_admin(request)
        if payload.author_id is None:
            raise HTTPException(status_code=400, detail="author_id_required_for_admin")
        author_id = payload.author_id
    except HTTPException as exc_admin:
        if exc_admin.status_code not in (
            HTTPStatus.UNAUTHORIZED,
            HTTPStatus.FORBIDDEN,
        ):
            raise
        # 관리자 아니면 회원 체크
        member = require_member(request)
        # require_member 성공 시 member.id는 항상 존재 (primary key 보장)
        if member.id is None:
            raise HTTPException(
                status_code=500, detail="Member ID is None"
            ) from None
        author_id = member.id

    comment = comments_service.create_comment(db, payload, author_id)
    return schemas.CommentRead.model_validate(comment)


@router.delete("/{comment_id}", status_code=204)
def delete_comment(
    comment_id: int,
    request: Request,
    db: Session = Depends(get_db),
) -> None:
    """댓글 삭제 (본인 또는 관리자)"""
    # 관리자 또는 회원 체크
    is_admin = False
    requester_id: int
    try:
        require_admin(request)
        is_admin = True
        requester_id = 0  # 관리자는 ID 체크 안 함
    except HTTPException as exc_admin:
        if exc_admin.status_code not in (
            HTTPStatus.UNAUTHORIZED,
            HTTPStatus.FORBIDDEN,
        ):
            raise
        member = require_member(request)
        # require_member 성공 시 member.id는 항상 존재 (primary key 보장)
        if member.id is None:
            raise HTTPException(
                status_code=500, detail="Member ID is None"
            ) from None
        requester_id = member.id

    comments_service.delete_comment(db, comment_id, requester_id, is_admin)
