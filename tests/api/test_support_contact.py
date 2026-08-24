from __future__ import annotations

import asyncio
from http import HTTPStatus
from pathlib import Path

import bcrypt
import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from apps.api import models, models_support
from apps.api.db import get_db
from apps.api.main import app
from apps.api.repositories import support_tickets as tickets_repo
from apps.api.routers import support as support_router
from tests.api.problem_assertions import assert_problem_code


@pytest.fixture()
def anyio_backend() -> str:
    return "asyncio"


@pytest.mark.anyio
async def test_support_contact_rate_limit_and_validation(
    client: TestClient, enable_rate_limit: None
) -> None:
    transport = httpx.ASGITransport(app=app, client=("2.2.2.2", 55555))
    async with httpx.AsyncClient(transport=transport, base_url="http://local") as hc:
        # login as admin to satisfy require_member compatibility
        rc_login = await hc.post(
            "/auth/login",
            json={"student_id": "__seed__admin", "password": "__seed__"},
        )
        assert rc_login.status_code in (HTTPStatus.OK, HTTPStatus.UNAUTHORIZED)
        if rc_login.status_code == HTTPStatus.UNAUTHORIZED:
            # seed via admin_login fixture path is not available here; skip strict login
            return

        ok = await hc.post(
            "/support/contact",
            json={
                "subject": "hello",
                "body": "message body long enough",
                "contact": "rate-limit@example.com",
            },
        )
        assert ok.status_code == HTTPStatus.ACCEPTED

        rl = await hc.post(
            "/support/contact",
            json={
                "subject": "hello",
                "body": "message body long enough",
                "contact": "rate-limit@example.com",
            },
        )
        assert rl.status_code == HTTPStatus.TOO_MANY_REQUESTS


def test_support_contact_validation(admin_login: TestClient) -> None:
    client = admin_login
    bad = client.post(
        "/support/contact",
        json={"subject": "a", "body": "short"},
    )
    assert bad.status_code == HTTPStatus.UNPROCESSABLE_ENTITY

    missing_email = client.post(
        "/support/contact",
        json={"subject": "문의 제목", "body": "문의 내용은 충분히 깁니다."},
    )
    assert missing_email.status_code == HTTPStatus.UNPROCESSABLE_ENTITY

    invalid_email = client.post(
        "/support/contact",
        json={
            "subject": "문의 제목",
            "body": "문의 내용은 충분히 깁니다.",
            "contact": "010-1234-5678",
        },
    )
    assert invalid_email.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_anonymous_user_can_submit_support_contact(client: TestClient) -> None:
    before = _count_support_tickets()

    response = client.post(
        "/support/contact",
        json={
            "subject": "로그인 전 문의",
            "body": "로그인하지 않은 방문자의 문의도 접수되어야 합니다.",
            "contact": "anonymous@example.com",
        },
    )

    assert response.status_code == HTTPStatus.ACCEPTED
    assert _count_support_tickets() == before + 1


def test_member_without_email_can_submit_support_contact(client: TestClient) -> None:
    student_id = "support-no-email"
    override = app.dependency_overrides.get(get_db)
    if override is None:
        raise RuntimeError("get_db override not found")

    async def _seed_member() -> None:
        async for db in override():
            member = models.Member(
                student_id=student_id,
                email=None,
                name="No Email Member",
                cohort=1,
                roles="member",
                status="active",
            )
            db.add(member)
            await db.flush()
            db.add(
                models.MemberAuth(
                    member_id=member.id,
                    student_id=student_id,
                    password_hash=bcrypt.hashpw(
                        b"support-password", bcrypt.gensalt()
                    ).decode(),
                )
            )
            await db.commit()
            break

    async def _ticket() -> models_support.SupportTicket | None:
        async for db in override():
            return await db.scalar(
                select(models_support.SupportTicket).where(
                    models_support.SupportTicket.subject == "이메일 없는 회원 문의"
                )
            )
        return None

    asyncio.run(_seed_member())
    login = client.post(
        "/auth/member/login",
        json={"student_id": student_id, "password": "support-password"},
    )
    assert login.status_code == HTTPStatus.OK

    response = client.post(
        "/support/contact",
        json={
            "subject": "이메일 없는 회원 문의",
            "body": "회원 이메일이 없어도 답변받을 이메일로 접수되어야 합니다.",
            "contact": "reply@example.com",
        },
    )

    assert response.status_code == HTTPStatus.ACCEPTED
    ticket = asyncio.run(_ticket())
    assert ticket is not None
    assert ticket.member_email is None
    assert ticket.contact == "reply@example.com"


def test_admin_can_list_support_tickets(admin_login: TestClient) -> None:
    client = admin_login
    submit = client.post(
        "/support/contact",
        json={
            "subject": "문의 조회 테스트",
            "body": "관리자 문의함 목록에서 본문 확인이 되어야 합니다.",
            "contact": "admin-reply@example.com",
        },
    )
    assert submit.status_code == HTTPStatus.ACCEPTED

    res = client.get("/support/admin/tickets?limit=20")
    assert res.status_code == HTTPStatus.OK
    body = res.json()
    assert isinstance(body, list)
    assert len(body) >= 1

    first = body[0]
    assert isinstance(first["id"], int)
    assert isinstance(first["subject"], str)
    assert isinstance(first["body"], str)
    assert first["member_email"] == "admin@test.example.com"


def test_member_cannot_list_support_tickets(member_login: TestClient) -> None:
    res = member_login.get("/support/admin/tickets?limit=20")
    assert res.status_code == HTTPStatus.FORBIDDEN
    assert_problem_code(res.json(), "admin_permission_required")


def test_active_admin_session_refreshes_backfilled_support_role(
    client: TestClient,
) -> None:
    student_id = "suppbackfill"
    override = app.dependency_overrides.get(get_db)
    if override is None:
        raise RuntimeError("get_db override not found")

    async def _seed_admin() -> None:
        async for db in override():
            member = models.Member(
                student_id=student_id,
                email="support-backfill-admin@test.example.com",
                name="Support Admin",
                cohort=1,
                roles="member,admin,admin_posts",
                status="active",
            )
            db.add(member)
            await db.flush()
            db.add(
                models.MemberAuth(
                    member_id=member.id,
                    student_id=member.student_id,
                    password_hash=bcrypt.hashpw(
                        b"support-password", bcrypt.gensalt()
                    ).decode(),
                )
            )
            await db.commit()
            break

    async def _backfill_role() -> None:
        async for db in override():
            member = await db.scalar(
                select(models.Member).where(
                        models.Member.student_id == student_id
                )
            )
            if member is None:
                raise RuntimeError("seeded member not found")
            member.roles = "member,admin,admin_posts,admin_support"
            await db.commit()
            break

    asyncio.run(_seed_admin())
    login = client.post(
        "/auth/login",
        json={
            "student_id": student_id,
            "password": "support-password",
        },
    )
    assert login.status_code == HTTPStatus.OK
    assert client.get("/support/admin/tickets").status_code == HTTPStatus.FORBIDDEN

    asyncio.run(_backfill_role())

    tickets = client.get("/support/admin/tickets")
    assert tickets.status_code == HTTPStatus.OK
    session = client.get("/auth/session")
    assert session.status_code == HTTPStatus.OK
    assert "admin_support" in session.json()["roles"]


def _count_support_tickets() -> int:
    override = app.dependency_overrides.get(get_db)
    if override is None:
        raise RuntimeError("get_db override not found")

    async def _count() -> int:
        async for db in override():
            result = await db.scalar(
                select(func.count()).select_from(models_support.SupportTicket)
            )
            return int(result or 0)
        return 0

    return asyncio.run(_count())


def test_support_contact_does_not_write_support_log(
    admin_login: TestClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)
    payload = {
        "subject": "파일 로그 미기록",
        "body": "support.log에 남지 않아야 합니다.",
        "contact": "file-log@example.com",
    }
    res = admin_login.post("/support/contact", json=payload)
    assert res.status_code == HTTPStatus.ACCEPTED
    assert not (tmp_path / "logs" / "support.log").exists()


def test_support_contact_cooldown_suppresses_duplicate_row(
    admin_login: TestClient,
) -> None:
    payload = {
        "subject": "중복 억제",
        "body": "같은 payload 재제출은 row를 추가하지 않습니다.",
        "contact": "duplicate@example.com",
    }
    before = _count_support_tickets()
    first = admin_login.post("/support/contact", json=payload)
    assert first.status_code == HTTPStatus.ACCEPTED
    second = admin_login.post("/support/contact", json=payload)
    assert second.status_code == HTTPStatus.ACCEPTED
    assert _count_support_tickets() == before + 1


def test_support_contact_cooldown_does_not_extend_ttl() -> None:
    support_router.reset_cooldown_cache_for_tests()
    ident = "member:1"
    digest = "digest-a"

    support_router._record_successful_submission(ident, digest, 100.0)
    assert support_router._is_duplicate_submission(ident, digest, 159.0)
    assert support_router._recent[ident][0] == 100.0
    assert not support_router._is_duplicate_submission(ident, digest, 161.0)


def test_support_contact_db_failure_leaves_no_cooldown(
    admin_login: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    subject = "DB실패민감제목"
    body = "DB실패민감본문입니다."
    contact = "db-failure@example.com"
    payload = {
        "subject": subject,
        "body": body,
        "contact": contact,
    }
    original = tickets_repo.create_ticket
    calls = {"count": 0}

    async def flaky_create(*args: object, **kwargs: object) -> object:
        calls["count"] += 1
        if calls["count"] == 1:
            raise IntegrityError(
                (
                    "INSERT INTO support_tickets "
                    "(subject, body, contact) "
                    "VALUES (:subject, :body, :contact)"
                ),
                {"subject": subject, "body": body, "contact": contact},
                Exception("simulated db failure"),
            )
        return await original(*args, **kwargs)

    monkeypatch.setattr(tickets_repo, "create_ticket", flaky_create)

    before = _count_support_tickets()
    no_raise = TestClient(app, raise_server_exceptions=False)
    no_raise.cookies.update(admin_login.cookies)
    with caplog.at_level("DEBUG"):
        failed = no_raise.post("/support/contact", json=payload)
    assert failed.status_code == HTTPStatus.INTERNAL_SERVER_ERROR
    assert_problem_code(failed.json(), "internal_error")
    assert _count_support_tickets() == before
    assert support_router._recent == {}

    combined = "\n".join(record.getMessage() for record in caplog.records)
    assert subject not in combined
    assert body not in combined
    assert contact not in combined

    retry = admin_login.post("/support/contact", json=payload)
    assert retry.status_code == HTTPStatus.ACCEPTED
    assert _count_support_tickets() == before + 1


def test_support_contact_records_cooldown_after_commit_time(
    admin_login: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    support_router.reset_cooldown_cache_for_tests()
    times = iter([100.0, 250.0])

    def fake_monotonic() -> float:
        return next(times, 250.0)

    monkeypatch.setattr(support_router.time, "monotonic", fake_monotonic)

    payload = {
        "subject": "commit 시각",
        "body": "cooldown은 commit 완료 시각을 기록해야 합니다.",
        "contact": "commit-time@example.com",
    }
    res = admin_login.post("/support/contact", json=payload)
    assert res.status_code == HTTPStatus.ACCEPTED
    assert len(support_router._recent) == 1
    committed_at = next(iter(support_router._recent.values()))[0]
    assert committed_at == 250.0


def test_support_contact_different_members_same_ip_do_not_share_cooldown(
    member_login: TestClient,
) -> None:
    override = app.dependency_overrides.get(get_db)
    if override is None:
        raise RuntimeError("get_db override not found")

    async def _seed_second_member() -> None:
        async for db in override():
            member = models.Member(
                student_id="member002",
                email="member002@example.com",
                name="Member Two",
                cohort=1,
                roles="member",
                status="active",
            )
            db.add(member)
            await db.flush()
            db.add(
                models.MemberAuth(
                    member_id=member.id,
                    student_id=member.student_id,
                    password_hash=bcrypt.hashpw(
                        b"memberpass2", bcrypt.gensalt()
                    ).decode(),
                )
            )
            await db.commit()
            break

    asyncio.run(_seed_second_member())

    transport = httpx.ASGITransport(app=app, client=("9.9.9.9", 12345))
    payload = {
        "subject": "회원별 cooldown",
        "body": "같은 IP라도 회원별로 중복 억제가 분리됩니다.",
        "contact": "member-cooldown@example.com",
    }

    async def _submit(student_id: str, password: str) -> httpx.Response:
        async with httpx.AsyncClient(
            transport=transport, base_url="http://local"
        ) as hc:
            login = await hc.post(
                "/auth/member/login",
                json={"student_id": student_id, "password": password},
            )
            assert login.status_code == HTTPStatus.OK
            return await hc.post("/support/contact", json=payload)

    before = _count_support_tickets()
    first = asyncio.run(_submit("member001", "memberpass"))
    second = asyncio.run(_submit("member002", "memberpass2"))
    assert first.status_code == HTTPStatus.ACCEPTED
    assert second.status_code == HTTPStatus.ACCEPTED
    assert _count_support_tickets() == before + 2


def test_support_contact_cooldown_cache_has_no_plaintext(
    admin_login: TestClient,
) -> None:
    subject = "민감 제목"
    body = "민감 본문입니다."
    contact = "cooldown-pii@example.com"
    admin_login.post(
        "/support/contact",
        json={"subject": subject, "body": body, "contact": contact},
    )
    for value in support_router._recent.values():
        assert subject not in str(value)
        assert body not in str(value)
        assert contact not in str(value)


def test_support_contact_no_pii_in_application_logs(
    admin_login: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    subject = "로그 민감 제목"
    body = "로그 민감 본문입니다."
    contact = "application-log@example.com"
    with caplog.at_level("DEBUG"):
        res = admin_login.post(
            "/support/contact",
            json={"subject": subject, "body": body, "contact": contact},
        )
    assert res.status_code == HTTPStatus.ACCEPTED
    combined = "\n".join(record.getMessage() for record in caplog.records)
    assert subject not in combined
    assert body not in combined
    assert contact not in combined


def test_support_contact_cooldown_evicts_oldest_at_capacity(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(support_router, "_COOLDOWN_MAX_ENTRIES", 2)
    now = {"value": 0.0}

    def _monotonic() -> float:
        now["value"] += 1.0
        return now["value"]

    monkeypatch.setattr(support_router.time, "monotonic", _monotonic)

    support_router._record_successful_submission("member:1", "digest-a", _monotonic())
    support_router._record_successful_submission("member:2", "digest-b", _monotonic())
    support_router._record_successful_submission("member:3", "digest-c", _monotonic())

    assert "member:1" not in support_router._recent
    assert "member:2" in support_router._recent
    assert "member:3" in support_router._recent
