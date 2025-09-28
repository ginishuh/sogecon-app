from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db

router = APIRouter(prefix="/members", tags=["members"])


@router.get("/", response_model=List[schemas.MemberRead])
def list_members(
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> List[schemas.MemberRead]:
    members = db.query(models.Member).offset(offset).limit(limit).all()
    return [schemas.MemberRead.model_validate(member) for member in members]


@router.get("/{member_id}", response_model=schemas.MemberRead)
def get_member(member_id: int, db: Session = Depends(get_db)) -> schemas.MemberRead:
    member = db.get(models.Member, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return schemas.MemberRead.model_validate(member)


@router.post("/", response_model=schemas.MemberRead, status_code=201)
def create_member(payload: schemas.MemberCreate, db: Session = Depends(get_db)) -> schemas.MemberRead:
    member = models.Member(**payload.model_dump())
    db.add(member)
    db.commit()
    db.refresh(member)
    return schemas.MemberRead.model_validate(member)
