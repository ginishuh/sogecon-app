"""가입 신청 접수·승인·반려의 동시 요청 직렬화 테스트.

두 개의 독립 DB 세션(별도 엔진)에서 서비스 함수를 동시에 실행하고, 사전
확인과 쓰기 사이에 지연을 넣어 잠금이 없으면 둘 다 성공하는 상황을 만든다.
잠금이 있으면 뒤 요청은 앞 트랜잭션이 끝날 때까지 기다린 뒤 409가 된다.
"""

from __future__ import annotations

import asyncio
import os
from collections.abc import Awaitable, Callable
from typing import Any, cast

from fastapi.testclient import TestClient
from pytest import MonkeyPatch
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from apps.api import models, schemas
from apps.api.errors import ConflictError
from apps.api.services import signup_approval_service, signup_service

_DELAY_SECONDS = 0.4
_ADMIN = "__seed__admin"

SessionCall = Callable[[AsyncSession], Awaitable[Any]]


def _test_db_url() -> str:
    return (
        os.environ.get("TEST_DB_URL")
        or os.environ.get("DATABASE_URL")
        or "postgresql+psycopg://app:devpass@localhost:5434/appdb_test"
    )


def _run_concurrently(*calls: tuple[float, SessionCall]) -> list[Any]:
    """각 호출을 별도 세션에서 (시작 지연, 함수) 순서로 동시에 실행한다."""

    async def _main() -> list[Any]:
        engine = create_async_engine(_test_db_url())
        maker = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)

        async def _one(start_delay: float, fn: SessionCall) -> Any:
            await asyncio.sleep(start_delay)
            async with maker() as session:
                return await fn(session)

        try:
            return list(
                await asyncio.gather(
                    *(_one(delay, fn) for delay, fn in calls),
                    return_exceptions=True,
                )
            )
        finally:
            await engine.dispose()

    return asyncio.run(_main())


def _query(fn: Callable[[AsyncSession], Awaitable[Any]]) -> Any:
    return _run_concurrently((0, fn))[0]


def _conflict_codes(results: list[Any]) -> list[str]:
    codes: list[str] = []
    for result in results:
        if isinstance(result, BaseException):
            assert isinstance(result, ConflictError), repr(result)
            codes.append(result.code)
    return codes


def _seed_pending(*rows: tuple[str, str]) -> list[int]:
    async def _seed(session: AsyncSession) -> list[int]:
        created = [
            models.SignupRequest(
                student_id=student_id,
                email=email,
                name="동시신청",
                cohort=30,
                phone="01000000000",
            )
            for student_id, email in rows
        ]
        session.add_all(created)
        await session.commit()
        return [cast(int, row.id) for row in created]

    return cast(list[int], _query(_seed))


def _delay_after_checks(monkeypatch: MonkeyPatch) -> None:
    """승인 사전 확인 직후, 쓰기 직전에 지연을 넣는다."""
    original = signup_approval_service.issue_activation_token

    async def _slow(*args: Any, **kwargs: Any) -> Any:
        await asyncio.sleep(_DELAY_SECONDS)
        return await original(*args, **kwargs)

    monkeypatch.setattr(signup_approval_service, "issue_activation_token", _slow)


def _approve(signup_id: int) -> SessionCall:
    async def _call(session: AsyncSession) -> Any:
        return await signup_approval_service.approve_signup_request(
            session, signup_request_id=signup_id, decided_by_student_id=_ADMIN
        )

    return _call


def _count(stmt: Any) -> int:
    async def _call(session: AsyncSession) -> int:
        return int((await session.execute(stmt)).scalar_one())

    return cast(int, _query(_call))


def test_concurrent_signups_with_variant_student_ids_keep_one_pending(
    client: TestClient, monkeypatch: MonkeyPatch
) -> None:
    del client
    original = signup_service.signup_requests_repo.create_signup_request

    async def _slow_create(*args: Any, **kwargs: Any) -> Any:
        await asyncio.sleep(_DELAY_SECONDS)
        return await original(*args, **kwargs)

    monkeypatch.setattr(
        signup_service.signup_requests_repo, "create_signup_request", _slow_create
    )

    def _signup(student_id: str) -> SessionCall:
        async def _call(session: AsyncSession) -> Any:
            return await signup_service.create_signup_request(
                session,
                schemas.SignupRequestCreate(
                    student_id=student_id,
                    email=f"{student_id.lower()}@test.example.com",
                    name="동시신청",
                    cohort=30,
                    phone="010-0000-0000",
                ),
            )

        return _call

    results = _run_concurrently((0, _signup("S72001")), (0.05, _signup("72001")))

    assert _conflict_codes(results) == ["signup_already_pending"]
    pending = _count(
        select(func.count(models.SignupRequest.id)).where(
            models.SignupRequest.status == "pending"
        )
    )
    assert pending == 1


def test_concurrent_approvals_of_variant_requests_create_one_member(
    client: TestClient, monkeypatch: MonkeyPatch
) -> None:
    del client
    first, second = _seed_pending(
        ("S72002", "a72002@test.example.com"), ("72002", "b72002@test.example.com")
    )
    _delay_after_checks(monkeypatch)

    results = _run_concurrently((0, _approve(first)), (0.05, _approve(second)))

    assert _conflict_codes(results) == ["signup_member_exists"]
    members = _count(
        select(func.count(models.Member.id)).where(
            models.Member.student_id.in_(["S72002", "72002"])
        )
    )
    assert members == 1


def test_concurrent_approvals_with_case_only_email_difference(
    client: TestClient, monkeypatch: MonkeyPatch
) -> None:
    del client
    first, second = _seed_pending(
        ("s72003", "Same72003@test.example.com"),
        ("s72004", "same72003@test.example.com"),
    )
    _delay_after_checks(monkeypatch)

    results = _run_concurrently((0, _approve(first)), (0.05, _approve(second)))

    assert _conflict_codes(results) == ["signup_email_in_use"]
    members = _count(
        select(func.count(models.Member.id)).where(
            func.lower(models.Member.email) == "same72003@test.example.com"
        )
    )
    assert members == 1


def test_double_approval_of_same_request_issues_once(
    client: TestClient, monkeypatch: MonkeyPatch
) -> None:
    del client
    (signup_id,) = _seed_pending(("s72005", "s72005@test.example.com"))
    _delay_after_checks(monkeypatch)

    results = _run_concurrently((0, _approve(signup_id)), (0.05, _approve(signup_id)))

    assert _conflict_codes(results) == ["signup_request_not_pending"]
    approve_logs = _count(
        select(func.count(models.SignupActivationIssueLog.id)).where(
            models.SignupActivationIssueLog.signup_request_id == signup_id,
            models.SignupActivationIssueLog.issued_type == "approve",
        )
    )
    assert approve_logs == 1


def test_approve_and_reject_race_has_single_outcome(
    client: TestClient, monkeypatch: MonkeyPatch
) -> None:
    del client
    (signup_id,) = _seed_pending(("s72006", "s72006@test.example.com"))
    _delay_after_checks(monkeypatch)

    async def _reject(session: AsyncSession) -> Any:
        return await signup_service.reject_signup_request(
            session,
            signup_request_id=signup_id,
            decided_by_student_id=_ADMIN,
            reject_reason="동시 처리",
        )

    results = _run_concurrently((0, _approve(signup_id)), (0.1, _reject))

    assert _conflict_codes(results) == ["signup_request_not_pending"]

    async def _final(session: AsyncSession) -> tuple[str, str | None]:
        row = (
            await session.execute(
                select(models.SignupRequest).where(models.SignupRequest.id == signup_id)
            )
        ).scalar_one()
        return cast(str, row.status), cast(str | None, row.reject_reason)

    assert _query(_final) == ("approved", None)


def _seed_preregistered_member(student_id: str, email: str) -> None:
    async def _seed(session: AsyncSession) -> None:
        session.add(
            models.Member(
                student_id=student_id,
                email=email,
                name="사전등록",
                cohort=30,
                roles="member",
                status="pending",
                visibility=models.Visibility.PRIVATE,
            )
        )
        await session.commit()

    _query(_seed)


def _suspend(student_id: str) -> SessionCall:
    async def _call(session: AsyncSession) -> None:
        member = (
            await session.execute(
                select(models.Member).where(models.Member.student_id == student_id)
            )
        ).scalar_one()
        setattr(member, "status", "suspended")
        await session.commit()

    return _call


def _member_status(student_id: str) -> str:
    async def _call(session: AsyncSession) -> str:
        return cast(
            str,
            (
                await session.execute(
                    select(models.Member.status).where(
                        models.Member.student_id == student_id
                    )
                )
            ).scalar_one(),
        )

    return cast(str, _query(_call))


def test_suspension_between_check_and_lock_blocks_reuse(
    client: TestClient, monkeypatch: MonkeyPatch
) -> None:
    """후보 조회 뒤, 회원 행 잠금 전에 정지가 커밋되면 최신 값으로 거절한다."""
    del client
    _seed_preregistered_member("s72007", "s72007@test.example.com")
    (signup_id,) = _seed_pending(("s72007", "s72007@test.example.com"))
    original = signup_approval_service.members_repo.get_member_for_update

    async def _slow_lock(*args: Any, **kwargs: Any) -> Any:
        await asyncio.sleep(_DELAY_SECONDS)
        return await original(*args, **kwargs)

    monkeypatch.setattr(
        signup_approval_service.members_repo, "get_member_for_update", _slow_lock
    )

    results = _run_concurrently((0, _approve(signup_id)), (0.05, _suspend("s72007")))

    assert _conflict_codes(results) == ["signup_member_account_exists"]
    assert _member_status("s72007") == "suspended"


def test_suspension_after_lock_waits_and_is_kept(
    client: TestClient, monkeypatch: MonkeyPatch
) -> None:
    """회원 행을 잠근 뒤의 정지는 승인 커밋을 기다렸다가 적용돼 덮이지 않는다."""
    del client
    _seed_preregistered_member("s72008", "s72008@test.example.com")
    (signup_id,) = _seed_pending(("s72008", "s72008@test.example.com"))
    _delay_after_checks(monkeypatch)

    results = _run_concurrently((0, _approve(signup_id)), (0.1, _suspend("s72008")))

    assert _conflict_codes(results) == []
    assert _member_status("s72008") == "suspended"
