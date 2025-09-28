from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db

router = APIRouter(prefix="/posts", tags=["posts"])


@router.get("/", response_model=List[schemas.PostRead])
def list_posts(
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> List[schemas.PostRead]:
    posts = (
        db.query(models.Post)
        .order_by(models.Post.published_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [schemas.PostRead.model_validate(post) for post in posts]


@router.get("/{post_id}", response_model=schemas.PostRead)
def get_post(post_id: int, db: Session = Depends(get_db)) -> schemas.PostRead:
    post = db.get(models.Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return schemas.PostRead.model_validate(post)


@router.post("/", response_model=schemas.PostRead, status_code=201)
def create_post(payload: schemas.PostCreate, db: Session = Depends(get_db)) -> schemas.PostRead:
    author = db.get(models.Member, payload.author_id)
    if not author:
        raise HTTPException(status_code=404, detail="Author not found")
    post = models.Post(**payload.model_dump())
    db.add(post)
    db.commit()
    db.refresh(post)
    return schemas.PostRead.model_validate(post)
