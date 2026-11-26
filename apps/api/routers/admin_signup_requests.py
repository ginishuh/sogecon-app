"""관리자 가입신청 심사 API."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field
from slowapi import Limiter
from sqlalchemy.ext.asyncio import AsyncSession

from .. import schemas
from ..config import get_settings
from ..db import get_db
from ..ratelimit import consume_limit, get_client_ip_for_rate_limit
from ..services import signup_approval_service, signup_service
from ..services.auth_service import (
    CurrentUser,
    require_permission,
)

router = APIRouter(prefix="/admin/signup-requests", tags=["admin-signup-requests"])
limiter_signup = Limiter(
    key_func=get_client_ip_for_rate_limit,
    key_style="endpoint",
)


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


class SignupActivationEmailResult(BaseModel):
    """승인·토큰 재발급 직후 안내 메일 자동 발송 결과.

    - `sent`: 발송 완료. `sent_to`는 수신 주소(수동 발송 응답과 같은 노출 수준).
    - `failed`: 승인·재발급은 완료됐지만 발송하지 못함. `error_code`는
      `email_not_configured`·`email_send_failed`·`email_recipient_missing` 등.
    """

    status: Literal["sent", "failed"]
    sent_to: str | None = None
    error_code: str | None = None


class SignupActivationIssueResponse(BaseModel):
    request: schemas.SignupRequestRead
    activation_context: SignupActivationContextResponse
    activation_token: str
    activation_issue: schemas.SignupActivationIssueLogRead
    activation_email: SignupActivationEmailResult


class SignupActivationIssueLogListResponse(BaseModel):
    items: list[schemas.SignupActivationIssueLogRead]


class SignupRejectPayload(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class SignupActivationEmailSendPayload(BaseModel):
    activation_token: str = Field(min_length=8, max_length=4096)


class SignupActivationEmailSendResponse(BaseModel):
    sent_to: str


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


@router.post(
    "/{signup_request_id}/approve",
    response_model=SignupActivationIssueResponse,
)
async def approve_signup_request(
    signup_request_id: int,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(
        require_permission("admin_signup", allow_admin_fallback=False)
    ),
) -> SignupActivationIssueResponse:
    result = await signup_approval_service.approve_signup_request(
        db,
        signup_request_id=signup_request_id,
        decided_by_student_id=user.student_id,
    )
    return _issue_response(
        request=result.request,
        context=result.context,
        token=result.token,
        issue_log=result.issue_log,
        email=result.email,
    )


def _issue_response(
    *,
    request: schemas.SignupRequestRead,
    context: signup_service.SignupActivationContext,
    token: str,
    issue_log: schemas.SignupActivationIssueLogRead,
    email: signup_approval_service.SignupActivationEmailOutcome,
) -> SignupActivationIssueResponse:
    return SignupActivationIssueResponse(
        request=request,
        activation_context=SignupActivationContextResponse(
            signup_request_id=context.signup_request_id,
            student_id=context.student_id,
            email=context.email,
            name=context.name,
            cohort=context.cohort,
        ),
        activation_token=token,
        activation_issue=issue_log,
        activation_email=SignupActivationEmailResult(
            status=email.status,
            sent_to=email.sent_to,
            error_code=email.error_code,
        ),
    )


@router.post(
    "/{signup_request_id}/reissue-token",
    response_model=SignupActivationIssueResponse,
)
async def reissue_signup_activation_token(
    signup_request_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(
        require_permission("admin_signup", allow_admin_fallback=False)
    ),
) -> SignupActivationIssueResponse:
    # 재발급은 새 링크를 메일로 보내므로 수동 발송과 같은 한도를 쓴다.
    _consume_activation_email_limit(request)
    result = await signup_approval_service.reissue_signup_activation_token(
        db,
        signup_request_id=signup_request_id,
        issued_by_student_id=user.student_id,
    )
    return _issue_response(
        request=result.request,
        context=result.context,
        token=result.token,
        issue_log=result.issue_log,
        email=result.email,
    )


def _consume_activation_email_limit(request: Request) -> None:
    consume_limit(
        limiter_signup,
        request,
        get_settings().rate_limit_activation_email,
        scope="admin_signup_activation_email",
    )


@router.get(
    "/{signup_request_id}/activation-token-logs",
    response_model=SignupActivationIssueLogListResponse,
)
async def list_signup_activation_token_logs(
    signup_request_id: int,
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _user: CurrentUser = Depends(
        require_permission("admin_signup", allow_admin_fallback=False)
    ),
) -> SignupActivationIssueLogListResponse:
    rows = await signup_service.list_signup_activation_issue_logs(
        db,
        signup_request_id=signup_request_id,
        limit=limit,
    )
    return SignupActivationIssueLogListResponse(
        items=[
            schemas.SignupActivationIssueLogRead.model_validate(row)
            for row in rows
        ]
    )


@router.post(
    "/{signup_request_id}/send-activation-email",
    response_model=SignupActivationEmailSendResponse,
)
async def send_signup_activation_email(
    signup_request_id: int,
    payload: SignupActivationEmailSendPayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(
        require_permission("admin_signup", allow_admin_fallback=False)
    ),
) -> SignupActivationEmailSendResponse:
    _consume_activation_email_limit(request)
    result = await signup_service.send_signup_activation_email(
        db,
        signup_request_id=signup_request_id,
        activation_token=payload.activation_token,
        sent_by_student_id=user.student_id,
    )
    return SignupActivationEmailSendResponse(sent_to=result.sent_to)


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
