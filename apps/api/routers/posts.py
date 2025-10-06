from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .. import schemas
from ..db import get_db
from ..services import posts_service
from .auth import require_admin

router = APIRouter(prefix="/posts", tags=["posts"])


@router.get("/", response_model=list[schemas.PostRead])
def list_posts(
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> list[schemas.PostRead]:
    posts = posts_service.list_posts(db, limit=limit, offset=offset)
    return [schemas.PostRead.model_validate(post) for post in posts]


@router.get("/{post_id}", response_model=schemas.PostRead)
def get_post(post_id: int, db: Session = Depends(get_db)) -> schemas.PostRead:
    post = posts_service.get_post(db, post_id)
    return schemas.PostRead.model_validate(post)


@router.post("/", response_model=schemas.PostRead, status_code=201)
def create_post(
    payload: schemas.PostCreate,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
) -> schemas.PostRead:
    post = posts_service.create_post(db, payload)
    return schemas.PostRead.model_validate(post)
