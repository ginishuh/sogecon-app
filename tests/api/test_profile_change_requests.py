"""프로필 변경 요청 API 테스트 (이름/기수 승인 기반 + 이메일 즉시 수정)."""

from __future__ import annotations

import asyncio
from http import HTTPStatus

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from apps.api import models
from apps.api.db import get_db
from apps.api.main import app


@pytest.fixture()
def _seed_other_member(member_login: TestClient) -> TestClient:
    """member_login 외에 다른 멤버를 시드한다 (이메일 충돌 테스트용)."""
    override = app.dependency_overrides.get(get_db)
    assert override is not None, "get_db override not set"

    async def _seed() -> None:
        async for session in override():
            stmt = select(models.Member).where(
                models.Member.student_id == "other999"
            )
            result = await session.execute(stmt)
            if result.scalars().first() is None:
                session.add(
                    models.Member(
                        student_id="other999",
                        email="taken@example.com",
                        name="Other",
                        cohort=2,
                        roles="member",
                    )
                )
                await session.commit()
            break

    asyncio.run(_seed())
    return member_login


# ── 회원 변경요청 생성 ──────────────────────────────────────────────


def test_create_name_change_request(member_login: TestClient) -> None:
    """이름 변경요청 생성 → 201, status=pending."""
    res = member_login.post(
        "/me/change-requests",
        json={"field_name": "name", "new_value": "NewName"},
    )
    assert res.status_code == HTTPStatus.CREATED
    data = res.json()
    assert data["status"] == "pending"
    assert data["field_name"] == "name"
    assert data["new_value"] == "NewName"
    assert data["old_value"] == "Member"


def test_create_cohort_change_request(member_login: TestClient) -> None:
    """기수 변경요청 생성 → 201."""
    res = member_login.post(
        "/me/change-requests",
        json={"field_name": "cohort", "new_value": "99"},
    )
    assert res.status_code == HTTPStatus.CREATED
    data = res.json()
    assert data["field_name"] == "cohort"
    assert data["new_value"] == "99"


def test_duplicate_pending_same_field_409(member_login: TestClient) -> None:
    """동일 필드 중복 pending → 409."""
    member_login.post(
        "/me/change-requests",
        json={"field_name": "name", "new_value": "A"},
    )
    res2 = member_login.post(
        "/me/change-requests",
        json={"field_name": "name", "new_value": "B"},
    )
    assert res2.status_code == HTTPStatus.CONFLICT
    assert res2.json()["code"] == "profile_change_already_pending"


def test_different_fields_can_both_pending(member_login: TestClient) -> None:
    """다른 필드는 동시 pending 허용."""
    r1 = member_login.post(
        "/me/change-requests",
        json={"field_name": "name", "new_value": "A"},
    )
    r2 = member_login.post(
        "/me/change-requests",
        json={"field_name": "cohort", "new_value": "50"},
    )
    assert r1.status_code == HTTPStatus.CREATED
    assert r2.status_code == HTTPStatus.CREATED


def test_same_value_change_409(member_login: TestClient) -> None:
    """동일 값 변경 시도 → 409."""
    res = member_login.post(
        "/me/change-requests",
        json={"field_name": "name", "new_value": "Member"},
    )
    assert res.status_code == HTTPStatus.CONFLICT
    assert res.json()["code"] == "profile_change_same_value"


def test_list_my_change_requests(member_login: TestClient) -> None:
    """본인 요청 목록 조회."""
    member_login.post(
        "/me/change-requests",
        json={"field_name": "name", "new_value": "A"},
    )
    res = member_login.get("/me/change-requests")
    assert res.status_code == HTTPStatus.OK
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_unauthenticated_401(client: TestClient) -> None:
    """미인증 시 401."""
    r1 = client.post(
        "/me/change-requests",
        json={"field_name": "name", "new_value": "X"},
    )
    assert r1.status_code == HTTPStatus.UNAUTHORIZED
    r2 = client.get("/me/change-requests")
    assert r2.status_code == HTTPStatus.UNAUTHORIZED


# ── 관리자 API ──────────────────────────────────────────────────────


def test_admin_list_change_requests(
    member_login: TestClient, admin_login: TestClient
) -> None:
    """관리자 목록 조회 (status 필터)."""
    member_login.post(
        "/me/change-requests",
        json={"field_name": "name", "new_value": "TestAdmin"},
    )
    res = admin_login.get("/admin/profile-change-requests/?status=pending")
    assert res.status_code == HTTPStatus.OK
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] >= 1


def test_admin_approve(
    member_login: TestClient, admin_login: TestClient
) -> None:
    """승인 → member 실제 반영 확인."""
    cr = member_login.post(
        "/me/change-requests",
        json={"field_name": "name", "new_value": "ApprovedName"},
    )
    request_id = cr.json()["id"]

    res = admin_login.post(
        f"/admin/profile-change-requests/{request_id}/approve"
    )
    assert res.status_code == HTTPStatus.OK
    assert res.json()["status"] == "approved"

    # member에 반영되었는지 확인
    me = member_login.get("/me/")
    assert me.json()["name"] == "ApprovedName"


def test_admin_reject(
    member_login: TestClient, admin_login: TestClient
) -> None:
    """반려 → reason 기록 확인."""
    cr = member_login.post(
        "/me/change-requests",
        json={"field_name": "name", "new_value": "WillReject"},
    )
    request_id = cr.json()["id"]

    res = admin_login.post(
        f"/admin/profile-change-requests/{request_id}/reject",
        json={"reason": "부적절한 이름"},
    )
    assert res.status_code == HTTPStatus.OK
    data = res.json()
    assert data["status"] == "rejected"
    assert data["reject_reason"] == "부적절한 이름"


def test_admin_approve_non_pending_409(
    member_login: TestClient, admin_login: TestClient
) -> None:
    """non-pending 승인 시도 → 409."""
    cr = member_login.post(
        "/me/change-requests",
        json={"field_name": "name", "new_value": "X"},
    )
    request_id = cr.json()["id"]
    admin_login.post(
        f"/admin/profile-change-requests/{request_id}/approve"
    )

    # 이미 approved인 것을 다시 approve
    res = admin_login.post(
        f"/admin/profile-change-requests/{request_id}/approve"
    )
    assert res.status_code == HTTPStatus.CONFLICT
    assert res.json()["code"] == "profile_change_not_pending"


def test_admin_permission_required(member_login: TestClient) -> None:
    """일반 회원 → 관리자 API 403."""
    res = member_login.get("/admin/profile-change-requests/")
    assert res.status_code == HTTPStatus.FORBIDDEN


# ── 이메일 수정 테스트 ─────────────────────────────────────────────


def test_email_update_success(member_login: TestClient) -> None:
    """PUT /me/ email 수정 성공."""
    res = member_login.put("/me/", json={"email": "new@example.com"})
    assert res.status_code == HTTPStatus.OK
    assert res.json()["email"] == "new@example.com"


def test_email_duplicate_409(_seed_other_member: TestClient) -> None:
    """중복 이메일 → 409."""
    res = _seed_other_member.put("/me/", json={"email": "taken@example.com"})
    assert res.status_code == HTTPStatus.CONFLICT
    assert res.json()["code"] == "member_email_already_in_use"


def test_email_invalid_format_422(member_login: TestClient) -> None:
    """잘못된 이메일 형식 → 422."""
    res = member_login.put("/me/", json={"email": "not-an-email"})
    assert res.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_name_field_ignored_in_update(member_login: TestClient) -> None:
    """name 필드 전송 시 무시됨 확인 (하위호환)."""
    me_before = member_login.get("/me/").json()
    res = member_login.put("/me/", json={"name": "ShouldBeIgnored"})
    assert res.status_code == HTTPStatus.OK
    assert res.json()["name"] == me_before["name"]
