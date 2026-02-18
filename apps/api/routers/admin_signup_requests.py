"""관리자 가입신청 심사 API."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from .. import schemas
from ..db import get_db
from ..services import signup_service
from ..services.activation_service import create_member_activation_token
from ..services.auth_service import (
    CurrentUser,
    require_permission,
)

router = APIRouter(prefix="/admin/signup-requests", tags=["admin-signup-requests"])


class SignupRequestListParams(BaseModel):
    limit: int = Query(20, ge=1, le=100)
    offset: int = Query(0, ge=0)
    q: str | None = Query(default=None, min_length=1, max_length=100)
    status: schemas.SignupRequestStatusLiteral | None = Query(default=None)


class SignupRequestListResponse(BaseModel):
    items: list[schemas.SignupRequestRead]
    total: int


class SignupActivationContextResponse(BaseModel):
    signup_request_id: int
    student_id: str
    email: str
    name: str
    cohort: int


class SignupApproveResponse(BaseModel):
    request: schemas.SignupRequestRead
    activation_context: SignupActivationContextResponse
    activation_token: str


class SignupRejectPayload(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


@router.get("/", response_model=SignupRequestListResponse)
async def list_signup_requests(
    params: SignupRequestListParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _user: CurrentUser = Depends(
        require_permission("admin_signup", allow_admin_fallback=False)
    ),
) -> SignupRequestListResponse:
    filters: schemas.SignupRequestListFilters = {}
    if params.q is not None:
        filters["q"] = params.q
    if params.status is not None:
        filters["status"] = params.status

    rows, total = await signup_service.list_signup_requests_with_total(
        db,
        limit=params.limit,
        offset=params.offset,
        filters=filters or None,
    )
    return SignupRequestListResponse(
        items=[schemas.SignupRequestRead.model_validate(row) for row in rows],
        total=total,
    )


@router.post("/{signup_request_id}/approve", response_model=SignupApproveResponse)
async def approve_signup_request(
    signup_request_id: int,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(
        require_permission("admin_signup", allow_admin_fallback=False)
    ),
) -> SignupApproveResponse:
    row, context = await signup_service.approve_signup_request(
        db,
        signup_request_id=signup_request_id,
        decided_by_student_id=user.student_id,
    )
    return SignupApproveResponse(
        request=schemas.SignupRequestRead.model_validate(row),
        activation_context=SignupActivationContextResponse(
            signup_request_id=context.signup_request_id,
            student_id=context.student_id,
            email=context.email,
            name=context.name,
            cohort=context.cohort,
        ),
        activation_token=create_member_activation_token(
            signup_request_id=context.signup_request_id,
            student_id=context.student_id,
            cohort=context.cohort,
            name=context.name,
        ),
    )


@router.post("/{signup_request_id}/reject", response_model=schemas.SignupRequestRead)
async def reject_signup_request(
    signup_request_id: int,
    payload: SignupRejectPayload,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(
        require_permission("admin_signup", allow_admin_fallback=False)
    ),
) -> schemas.SignupRequestRead:
    row = await signup_service.reject_signup_request(
        db,
        signup_request_id=signup_request_id,
        decided_by_student_id=user.student_id,
        reject_reason=payload.reason,
    )
    return schemas.SignupRequestRead.model_validate(row)
