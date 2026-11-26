"""관리자 직접 회원 생성·회원 정보 수정이 가입 승인과 같은 중복 규칙을 따르는지.

학번은 `S90041` = `s90041` = `90041`처럼 표기만 달라도 같은 사람이고(비ASCII는
원문 완전 일치), 이메일은 대소문자와 저장 값 앞뒤 공백을 무시해 비교한다.
이 경로가 규칙을 우회하면 같은 사람의 회원 행이 둘 생긴다.
"""

from __future__ import annotations

import asyncio
import os
from collections.abc import Awaitable, Callable
from http import HTTPStatus
from typing import Any, cast

import httpx
import pytest
from fastapi.testclient import TestClient
from pytest import MonkeyPatch
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from apps.api import models, schemas
from apps.api.errors import ApiError
from apps.api.services import members_service
from apps.api.student_id_key import student_id_key
from tests.api.signup_helpers import run_in_test_session, seed_member


def _create_direct(
    client: TestClient, *, student_id: str, email: str
) -> httpx.Response:
    return client.post(
        "/admin/members/",
        json={
            "student_id": student_id,
            "email": email,
            "name": "직접생성",
            "cohort": 30,
            "roles": ["member"],
        },
    )


def _stored_student_ids(*, ascii_key_of: str) -> list[str]:
    """학번 키가 같은 모든 회원의 저장 학번(파이썬 키 규칙으로 정확 비교)."""
    key = student_id_key(ascii_key_of.strip())
    out: list[str] = []

    async def _load(session: AsyncSession) -> None:
        values = (await session.execute(select(models.Member.student_id))).scalars()
        out.extend(
            sorted(
                cast(str, v)
                for v in values
                if cast(str, v).strip().isascii()
                and student_id_key(cast(str, v).strip()) == key
            )
        )

    run_in_test_session(_load)
    return out


def _stored_student_ids_exact(student_id: str) -> list[str]:
    out: list[str] = []

    async def _load(session: AsyncSession) -> None:
        values = (await session.execute(select(models.Member.student_id))).scalars()
        out.extend(sorted(cast(str, v) for v in values if cast(str, v) == student_id))

    run_in_test_session(_load)
    return out


def _member_id(student_id: str) -> int:
    holder: dict[str, int] = {}

    async def _find(session: AsyncSession) -> None:
        holder["id"] = int(
            (
                await session.execute(
                    select(models.Member.id).where(
                        models.Member.student_id == student_id
                    )
                )
            ).scalar_one()
        )

    run_in_test_session(_find)
    return holder["id"]


def _member_email(student_id: str) -> str | None:
    holder: dict[str, str | None] = {}

    async def _find(session: AsyncSession) -> None:
        holder["email"] = cast(
            str | None,
            (
                await session.execute(
                    select(models.Member.email).where(
                        models.Member.student_id == student_id
                    )
                )
            ).scalar_one(),
        )

    run_in_test_session(_find)
    return holder["email"]


def _set_member_email(student_id: str, email: str) -> None:
    async def _update(session: AsyncSession) -> None:
        await session.execute(
            update(models.Member)
            .where(models.Member.student_id == student_id)
            .values(email=email)
        )
        await session.commit()

    run_in_test_session(_update)


# ---------------------------------------------------------------------------
# 관리자 직접 생성: 학번
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("stored", "requested"),
    [
        ("90041", "S90041"),
        ("S90042", "90042"),
        ("s90043", "S90043"),
        ("90044", " s90044 "),
        (" 90045 ", "S90045"),  # 저장 값 앞뒤 공백
    ],
)
def test_direct_create_rejects_student_id_variant_of_existing_member(
    admin_login: TestClient, stored: str, requested: str
) -> None:
    seed_member(student_id=stored, email=f"seed{requested.strip()}@test.example.com")

    res = _create_direct(
        admin_login, student_id=requested, email="new-variant@test.example.com"
    )

    assert res.status_code == HTTPStatus.CONFLICT, res.text
    assert res.json()["code"] == "member_exists"
    assert _stored_student_ids(ascii_key_of=stored) == [stored]


def test_direct_create_rejects_variant_of_preregistered_member(
    admin_login: TestClient,
) -> None:
    """비밀번호 없는 사전 등록 회원도 같은 사람이므로 새 행을 만들지 않는다."""
    seed_member(
        student_id="s90046",
        email="pre90046@test.example.com",
        status="pending",
        with_password=False,
    )

    res = _create_direct(
        admin_login, student_id="90046", email="other90046@test.example.com"
    )

    assert res.status_code == HTTPStatus.CONFLICT, res.text
    assert res.json()["code"] == "member_exists"
    assert _stored_student_ids(ascii_key_of="90046") == ["s90046"]


def test_direct_create_stores_trimmed_student_id(admin_login: TestClient) -> None:
    res = _create_direct(
        admin_login, student_id="  S90047\t", email="trim90047@test.example.com"
    )

    assert res.status_code == HTTPStatus.CREATED, res.text
    assert res.json()["member"]["student_id"] == "S90047"
    assert _stored_student_ids(ascii_key_of="90047") == ["S90047"]


@pytest.mark.parametrize("blank", ["", "   ", "\t"])
def test_direct_create_rejects_blank_student_id(
    admin_login: TestClient, blank: str
) -> None:
    res = _create_direct(
        admin_login, student_id=blank, email="blank-id@test.example.com"
    )

    assert res.status_code == HTTPStatus.UNPROCESSABLE_ENTITY, res.text
    assert _stored_student_ids_exact(blank) == []
    assert _stored_student_ids_exact("") == []


def test_direct_create_non_ascii_student_id_matches_exact_text_only(
    admin_login: TestClient,
) -> None:
    seed_member(student_id=" 대학원 90048 ", email="grad90048@test.example.com")

    same = _create_direct(
        admin_login, student_id="대학원 90048", email="grad-same@test.example.com"
    )
    assert same.status_code == HTTPStatus.CONFLICT, same.text
    assert same.json()["code"] == "member_exists"

    # 비ASCII 입력은 변형 매칭을 하지 않는다(내부 공백이 다르면 다른 값).
    different = _create_direct(
        admin_login, student_id="대학원90048", email="grad-diff@test.example.com"
    )
    assert different.status_code == HTTPStatus.CREATED, different.text
    assert _stored_student_ids_exact("대학원90048") == ["대학원90048"]


def test_direct_create_non_ascii_does_not_collide_with_ascii_key(
    admin_login: TestClient,
) -> None:
    """ASCII 회원 `90049`와 비ASCII 입력 `s90049번`은 키 비교 대상이 아니다."""
    seed_member(student_id="90049", email="ascii90049@test.example.com")

    res = _create_direct(
        admin_login, student_id="s90049번", email="nonascii90049@test.example.com"
    )

    assert res.status_code == HTTPStatus.CREATED, res.text


# ---------------------------------------------------------------------------
# 관리자 직접 생성: 이메일
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("stored_email", "requested_email"),
    [
        ("Case90050@Test.Example.com", "case90050@test.example.com"),
        ("case90051@test.example.com", "CASE90051@test.example.com"),
        (" Space90052@test.example.com ", "space90052@test.example.com"),
    ],
)
def test_direct_create_rejects_email_differing_only_by_case_or_whitespace(
    admin_login: TestClient, stored_email: str, requested_email: str
) -> None:
    seed_member(student_id="90053", email=stored_email)

    res = _create_direct(admin_login, student_id="90054", email=requested_email)

    assert res.status_code == HTTPStatus.CONFLICT, res.text
    assert res.json()["code"] == "member_email_already_in_use"
    assert _stored_student_ids(ascii_key_of="90054") == []


# ---------------------------------------------------------------------------
# 관리자 회원 정보 수정
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "owner_email",
    ["Owner90060@Test.Example.com", "  owner90060@test.example.com  "],
)
def test_admin_edit_rejects_email_used_by_other_member(
    admin_login: TestClient, owner_email: str
) -> None:
    seed_member(student_id="90060", email=owner_email)
    seed_member(student_id="90061", email="editor90061@test.example.com")

    res = admin_login.patch(
        f"/admin/members/{_member_id('90061')}",
        json={"email": "OWNER90060@test.example.com"},
    )

    assert res.status_code == HTTPStatus.CONFLICT, res.text
    assert res.json()["code"] == "member_email_already_in_use"
    assert _member_email("90061") == "editor90061@test.example.com"


def test_admin_edit_with_same_address_in_other_case_keeps_stored_email(
    admin_login: TestClient,
) -> None:
    seed_member(student_id="90062", email=" Self90062@Test.Example.com ")

    res = admin_login.patch(
        f"/admin/members/{_member_id('90062')}",
        json={"email": "SELF90062@test.example.com"},
    )

    # 같은 주소는 변경이 아니다. 저장된 값을 건드리지 않는다.
    assert res.status_code == HTTPStatus.OK, res.text
    assert _member_email("90062") == " Self90062@Test.Example.com "


# ---------------------------------------------------------------------------
# 본인 회원 정보 수정 (PUT /me/)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "owner_email",
    ["Owner90070@Test.Example.com", " owner90070@test.example.com\t"],
)
def test_profile_edit_rejects_email_used_by_other_member(
    member_login: TestClient, owner_email: str
) -> None:
    seed_member(student_id="90070", email=owner_email)
    before = _member_email("member001")

    res = member_login.put("/me/", json={"email": "owner90070@TEST.example.com"})

    assert res.status_code == HTTPStatus.CONFLICT, res.text
    assert res.json()["code"] == "member_email_already_in_use"
    assert _member_email("member001") == before


def test_profile_edit_with_same_address_in_other_case_keeps_stored_email(
    member_login: TestClient,
) -> None:
    _set_member_email("member001", " Self90071@Test.Example.com ")

    res = member_login.put("/me/", json={"email": "SELF90071@test.example.com"})

    # 같은 주소는 변경이 아니다. 저장된 값을 건드리지 않는다.
    assert res.status_code == HTTPStatus.OK, res.text
    assert _member_email("member001") == " Self90071@Test.Example.com "


# ---------------------------------------------------------------------------
# 이미 대소문자만 다른 이메일을 가진 기존 회원 둘(과거 자료)
# ---------------------------------------------------------------------------


def test_profile_edit_of_other_fields_works_when_legacy_emails_differ_by_case(
    member_login: TestClient,
) -> None:
    """본인 수정 화면은 이메일을 항상 함께 보낸다. 주소가 그대로면 통과한다."""
    seed_member(student_id="90090", email="Legacy90090@Test.Example.com")
    _set_member_email("member001", "legacy90090@TEST.example.com")

    res = member_login.put(
        "/me/",
        json={"email": "legacy90090@TEST.example.com", "company": "새 회사"},
    )

    assert res.status_code == HTTPStatus.OK, res.text
    assert res.json()["company"] == "새 회사"


def test_admin_edit_of_other_fields_works_when_legacy_emails_differ_by_case(
    admin_login: TestClient,
) -> None:
    seed_member(student_id="90091", email="Legacy90091@Test.Example.com")
    seed_member(student_id="90092", email="legacy90091@TEST.example.com")

    res = admin_login.patch(
        f"/admin/members/{_member_id('90092')}",
        json={"email": "legacy90091@TEST.example.com", "name": "이름수정"},
    )

    assert res.status_code == HTTPStatus.OK, res.text
    assert res.json()["name"] == "이름수정"


# ---------------------------------------------------------------------------
# 동시 직접 생성 (독립 세션 2개)
# ---------------------------------------------------------------------------

_DELAY_SECONDS = 0.4
SessionCall = Callable[[AsyncSession], Awaitable[Any]]


def _test_db_url() -> str:
    return (
        os.environ.get("TEST_DB_URL")
        or os.environ.get("DATABASE_URL")
        or "postgresql+psycopg://app:devpass@localhost:5434/appdb_test"
    )


def _run_concurrently(*calls: tuple[float, SessionCall]) -> list[Any]:
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


def _direct(student_id: str, email: str) -> SessionCall:
    async def _call(session: AsyncSession) -> Any:
        return await members_service.create_member_direct(
            session,
            schemas.DirectMemberCreatePayload(
                student_id=student_id,
                email=email,
                name="동시생성",
                cohort=30,
            ),
        )

    return _call


def _conflict_codes(results: list[Any]) -> list[str]:
    codes: list[str] = []
    for result in results:
        if isinstance(result, BaseException):
            assert isinstance(result, ApiError), repr(result)
            assert result.status == HTTPStatus.CONFLICT, repr(result)
            codes.append(result.code)
    return codes


def _delay_member_insert(monkeypatch: MonkeyPatch) -> None:
    """중복 확인 직후, 회원 행 추가 직전에 지연을 넣는다."""
    original = members_service.members_repo.add_member

    async def _slow(*args: Any, **kwargs: Any) -> Any:
        await asyncio.sleep(_DELAY_SECONDS)
        return await original(*args, **kwargs)

    monkeypatch.setattr(members_service.members_repo, "add_member", _slow)


def test_concurrent_direct_creates_with_variant_student_ids_create_one_member(
    client: TestClient, monkeypatch: MonkeyPatch
) -> None:
    del client
    _delay_member_insert(monkeypatch)

    results = _run_concurrently(
        (0, _direct("S90080", "a90080@test.example.com")),
        (0, _direct("90080", "b90080@test.example.com")),
    )

    # 어느 쪽이 먼저 잠금을 잡든 하나만 성공하고 회원 행은 하나만 남는다.
    assert _conflict_codes(results) == ["member_exists"]
    assert len(_stored_student_ids(ascii_key_of="90080")) == 1


def test_concurrent_direct_creates_with_case_only_email_difference(
    client: TestClient, monkeypatch: MonkeyPatch
) -> None:
    del client
    _delay_member_insert(monkeypatch)

    results = _run_concurrently(
        (0, _direct("90081", "Same90081@test.example.com")),
        (0, _direct("90082", "same90081@test.example.com")),
    )

    # 어느 쪽이 먼저 잠금을 잡든 하나만 성공하고 회원 행은 하나만 남는다.
    assert _conflict_codes(results) == ["member_email_already_in_use"]
    winners = _stored_student_ids(ascii_key_of="90081") + _stored_student_ids(
        ascii_key_of="90082"
    )
    assert len(winners) == 1
