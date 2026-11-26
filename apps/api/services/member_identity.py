"""회원 쓰기 경로(관리자 직접 생성·회원 정보 수정)의 학번·이메일 중복 판정.

가입 접수·승인과 같은 비교 규칙(`apps/api/student_id_key.py`)과 같은 advisory
lock(학번 키 → 소문자 이메일 순서)을 써서, 표기만 다른 학번이나 대소문자·앞뒤
공백만 다른 이메일로 같은 사람의 회원 행이 둘 생기지 않게 한다.
"""

from __future__ import annotations

from typing import cast

from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..errors import AlreadyExistsError, ApiError
from ..repositories import members as members_repo
from ..repositories import signup_requests as signup_requests_repo
from ..student_id_key import clean_student_id


def require_student_id(raw: str) -> str:
    """앞뒤 공백만 지운 학번. 비면 로그인할 수 없는 회원이 되므로 422."""
    student_id = clean_student_id(raw)
    if not student_id:
        raise ApiError(
            code="student_id_required",
            detail="학번을 입력해 주세요.",
            status=422,
        )
    return student_id


async def lock_and_check_new_member_identity(
    db: AsyncSession, *, student_id: str, email: str
) -> None:
    """새 회원의 학번·이메일이 기존 회원과 겹치면 409로 거절한다.

    가입 접수·승인과 같은 advisory lock을 같은 순서(학번 키 → 소문자 이메일)로
    잡아 동시 생성·승인을 직렬화한 뒤, 같은 비교 규칙(학번 키, 대소문자·앞뒤
    공백 무시 이메일)으로 기존 회원을 찾는다.
    """
    await signup_requests_repo.lock_student_key(db, student_id)
    await signup_requests_repo.lock_email(db, email)
    if await members_repo.list_members_by_student_key(db, student_id):
        raise AlreadyExistsError(
            code="member_exists",
            detail="Student ID already in use",
        )
    if await members_repo.find_member_by_email_ci(db, email) is not None:
        raise AlreadyExistsError(
            code="member_email_already_in_use",
            detail="Email already in use",
        )


def is_same_email(left: str | None, right: str | None) -> bool:
    """대소문자와 앞뒤 공백만 다른 이메일은 같은 주소로 본다."""
    return (left or "").strip().lower() == (right or "").strip().lower()


async def lock_and_check_email_change(
    db: AsyncSession, *, member_id: int, email: str
) -> None:
    """바꿀 이메일을 다른 회원이 쓰고 있으면(대소문자·앞뒤 공백 무시) 409.

    호출 전에 `is_same_email`로 실제 변경인지 확인한다. 주소가 그대로인 저장은
    이 검사를 거치지 않는다(다른 항목만 고치는 수정이 막히지 않게).
    """
    await signup_requests_repo.lock_email(db, email)
    owner = await members_repo.find_member_by_email_ci(
        db, email, exclude_member_id=member_id
    )
    if owner is not None:
        raise AlreadyExistsError(
            code="member_email_already_in_use",
            detail="Email already in use",
        )


async def normalize_email_update(
    db: AsyncSession, *, member: models.Member, sanitized_data: dict[str, object]
) -> bool:
    """수정 요청의 이메일을 정규화하고 중복을 확인한다.

    반환값이 True면 주소가 그대로다(다른 항목만 수정). 이때 호출자는 이메일을
    쓰지 않는다. 그사이 다른 요청이 고친 주소를 화면이 읽어 둔 옛 값으로 덮지
    않기 위해서다.
    """
    email_value = sanitized_data.get("email")
    if not isinstance(email_value, str):
        return False
    normalized = email_value.strip().lower() or None
    sanitized_data["email"] = normalized
    if is_same_email(normalized, cast(str | None, member.email)):
        return True
    if normalized is not None:
        await lock_and_check_email_change(
            db, member_id=cast(int, member.id), email=normalized
        )
    return False
