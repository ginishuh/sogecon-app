from __future__ import annotations

from dataclasses import dataclass
from typing import cast

from fastapi import HTTPException
from itsdangerous import (
    BadData,
    BadSignature,
    SignatureExpired,
    URLSafeTimedSerializer,
)
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..config import get_settings
from ..errors import NotFoundError
from ..repositories import members as members_repo
from ..repositories import signup_requests as signup_requests_repo

ACTIVATION_SIGNER_NAMESPACE = "member-activate-v2"
ACTIVATION_TOKEN_MAX_AGE_SECONDS = 72 * 60 * 60


@dataclass(frozen=True)
class ActivationPayload:
    signup_request_id: int
    student_id: str


def create_member_activation_token(
    *,
    signup_request_id: int,
    student_id: str,
    cohort: int,
    name: str,
) -> str:
    settings = get_settings()
    serializer = URLSafeTimedSerializer(
        settings.jwt_secret,
        salt=ACTIVATION_SIGNER_NAMESPACE,
    )
    return serializer.dumps(
        {
            "signup_request_id": signup_request_id,
            "student_id": student_id,
            "cohort": cohort,
            "name": name,
        }
    )


def load_activation_payload(token: str) -> ActivationPayload:
    settings = get_settings()
    serializer = URLSafeTimedSerializer(
        settings.jwt_secret,
        salt=ACTIVATION_SIGNER_NAMESPACE,
    )
    try:
        data_raw: object = serializer.loads(
            token,
            max_age=ACTIVATION_TOKEN_MAX_AGE_SECONDS,
        )
    except (SignatureExpired, BadSignature, BadData) as err:
        raise HTTPException(
            status_code=401,
            detail="invalid_or_expired_activation_token",
        ) from err

    if not isinstance(data_raw, dict):
        raise HTTPException(status_code=422, detail="invalid_payload")
    data = cast(dict[str, object], data_raw)
    signup_request_id_obj = data.get("signup_request_id")
    student_id_obj = data.get("student_id")
    if not isinstance(signup_request_id_obj, int) or not isinstance(
        student_id_obj, str
    ):
        raise HTTPException(status_code=422, detail="invalid_payload")

    return ActivationPayload(
        signup_request_id=signup_request_id_obj,
        student_id=student_id_obj,
    )


async def resolve_activation_signup_request(
    db: AsyncSession,
    payload: ActivationPayload,
) -> models.SignupRequest:
    row = await signup_requests_repo.get_signup_request_by_id(
        db,
        payload.signup_request_id,
    )
    if row is None:
        raise HTTPException(
            status_code=401,
            detail="invalid_or_expired_activation_token",
        )
    if cast(str, row.student_id) != payload.student_id:
        raise HTTPException(
            status_code=401,
            detail="invalid_or_expired_activation_token",
        )

    row_status = cast(str, row.status)
    if row_status == "activated":
        raise HTTPException(status_code=409, detail="activation_already_used")
    if row_status != "approved":
        raise HTTPException(
            status_code=401,
            detail="invalid_or_expired_activation_token",
        )
    return row


async def resolve_activation_member(
    db: AsyncSession,
    student_id: str,
) -> models.Member:
    try:
        member = await members_repo.get_member_by_student_id(db, student_id)
    except NotFoundError:
        raise HTTPException(
            status_code=409,
            detail="activation_member_missing",
        ) from None
    # 승인 후 활성화 직전 상태 변경(예: suspended) 방어
    if cast(str, member.status) != "active":
        raise HTTPException(status_code=403, detail="member_not_active")
    return member
