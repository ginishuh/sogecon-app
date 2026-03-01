from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from http import HTTPStatus
from typing import cast

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api import models
from apps.api.db import get_db
from apps.api.main import app


def _run_in_test_session(fn: Callable[[AsyncSession], Awaitable[None]]) -> None:
    override = app.dependency_overrides.get(get_db)
    if override is None:
        raise RuntimeError("get_db override not found")

    async def _run() -> None:
        async for session in override():
            await fn(session)
            return
        raise RuntimeError("test session was not yielded")

    asyncio.run(_run())


def test_member_signup_success(client: TestClient) -> None:
    response = client.post(
        "/auth/member/signup",
        json={
            "student_id": "s116001",
            "email": "s116001@test.example.com",
            "name": "신청자",
            "cohort": 2024,
            "major": "경제학",
            "phone": "010-1234-5678",
            "note": "가입 신청합니다.",
        },
    )

    assert response.status_code == HTTPStatus.CREATED
    body = response.json()
    assert body["student_id"] == "s116001"
    assert body["status"] == "pending"
    assert body["phone"] == "01012345678"
    assert body["note"] == "가입 신청합니다."


def test_member_signup_duplicate_pending_returns_409(client: TestClient) -> None:
    payload = {
        "student_id": "s116002",
        "email": "s116002@test.example.com",
        "name": "신청자",
        "cohort": 2024,
        "phone": "010-2000-3000",
    }
    first = client.post("/auth/member/signup", json=payload)
    assert first.status_code == HTTPStatus.CREATED

    second = client.post("/auth/member/signup", json=payload)
    assert second.status_code == HTTPStatus.CONFLICT
    assert second.json()["code"] == "signup_already_pending"


def test_member_signup_active_member_conflict_returns_409(client: TestClient) -> None:
    async def _seed_active_member(session: AsyncSession) -> None:
        session.add(
            models.Member(
                student_id="s116003",
                email="s116003@test.example.com",
                name="기존회원",
                cohort=2020,
                roles="member",
                status="active",
            )
        )
        await session.commit()

    _run_in_test_session(_seed_active_member)

    response = client.post(
        "/auth/member/signup",
        json={
            "student_id": "s116003",
            "email": "s116003@test.example.com",
            "name": "신청자",
            "cohort": 2024,
            "phone": "010-2000-3001",
        },
    )

    assert response.status_code == HTTPStatus.CONFLICT
    assert response.json()["code"] == "member_already_active"


def test_admin_signup_review_approve_and_reject(
    admin_login: TestClient,
    member_login: TestClient,
) -> None:
    create_res = admin_login.post(
        "/auth/member/signup",
        json={
            "student_id": "s116004",
            "email": "s116004@test.example.com",
            "name": "승인대상",
            "cohort": 2024,
            "phone": "010-2000-3002",
            "note": "승인 요청",
        },
    )
    assert create_res.status_code == HTTPStatus.CREATED
    signup_id = create_res.json()["id"]

    forbidden_res = member_login.get("/admin/signup-requests")
    assert forbidden_res.status_code == HTTPStatus.FORBIDDEN
    assert forbidden_res.json()["detail"] == "admin_permission_required"

    relogin_res = admin_login.post(
        "/auth/login",
        json={"student_id": "__seed__admin", "password": "__seed__"},
    )
    assert relogin_res.status_code == HTTPStatus.OK

    list_res = admin_login.get("/admin/signup-requests?status=pending")
    assert list_res.status_code == HTTPStatus.OK
    assert list_res.json()["total"] >= 1

    approve_res = admin_login.post(f"/admin/signup-requests/{signup_id}/approve")
    assert approve_res.status_code == HTTPStatus.OK
    approve_body = approve_res.json()
    assert approve_body["request"]["status"] == "approved"
    assert approve_body["request"]["decided_by_student_id"] == "__seed__admin"
    assert approve_body["activation_context"]["signup_request_id"] == signup_id
    assert isinstance(approve_body["activation_token"], str)
    assert approve_body["activation_token"] != ""
    assert approve_body["activation_issue"]["issued_type"] == "approve"
    assert approve_body["activation_issue"]["issued_by_student_id"] == "__seed__admin"
    assert "token_hash" not in approve_body["activation_issue"]
    assert approve_body["activation_issue"]["token_tail"] is not None

    async def _assert_approved_member(session: AsyncSession) -> None:
        stmt = select(models.Member).where(models.Member.student_id == "s116004")
        member = (await session.execute(stmt)).scalars().first()
        assert member is not None
        assert cast(str, member.status) == "active"

    _run_in_test_session(_assert_approved_member)

    reject_create = admin_login.post(
        "/auth/member/signup",
        json={
            "student_id": "s116005",
            "email": "s116005@test.example.com",
            "name": "반려대상",
            "cohort": 2024,
            "phone": "010-2000-3003",
        },
    )
    assert reject_create.status_code == HTTPStatus.CREATED
    reject_id = reject_create.json()["id"]

    reject_res = admin_login.post(
        f"/admin/signup-requests/{reject_id}/reject",
        json={"reason": "학번 확인 불가"},
    )
    assert reject_res.status_code == HTTPStatus.OK
    reject_body = reject_res.json()
    assert reject_body["status"] == "rejected"
    assert reject_body["reject_reason"] == "학번 확인 불가"


def test_admin_signup_reissue_token_and_logs(admin_login: TestClient) -> None:
    create_res = admin_login.post(
        "/auth/member/signup",
        json={
            "student_id": "s116007",
            "email": "s116007@test.example.com",
            "name": "재발급대상",
            "cohort": 2024,
            "phone": "010-2000-3004",
        },
    )
    assert create_res.status_code == HTTPStatus.CREATED
    signup_id = create_res.json()["id"]

    approve_res = admin_login.post(f"/admin/signup-requests/{signup_id}/approve")
    assert approve_res.status_code == HTTPStatus.OK

    reissue_res = admin_login.post(f"/admin/signup-requests/{signup_id}/reissue-token")
    assert reissue_res.status_code == HTTPStatus.OK
    reissue_body = reissue_res.json()
    assert reissue_body["request"]["id"] == signup_id
    assert reissue_body["request"]["status"] == "approved"
    assert isinstance(reissue_body["activation_token"], str)
    assert reissue_body["activation_token"] != ""
    assert reissue_body["activation_issue"]["issued_type"] == "reissue"
    assert reissue_body["activation_issue"]["issued_by_student_id"] == "__seed__admin"
    assert "token_hash" not in reissue_body["activation_issue"]
    assert reissue_body["activation_issue"]["token_tail"] is not None

    logs_res = admin_login.get(
        f"/admin/signup-requests/{signup_id}/activation-token-logs?limit=10"
    )
    assert logs_res.status_code == HTTPStatus.OK
    logs_body = logs_res.json()
    assert len(logs_body["items"]) >= 2
    issued_types = {item["issued_type"] for item in logs_body["items"]}
    assert "approve" in issued_types
    assert "reissue" in issued_types


def test_reissue_requires_approved_status(admin_login: TestClient) -> None:
    create_res = admin_login.post(
        "/auth/member/signup",
        json={
            "student_id": "s116006",
            "email": "s116006@test.example.com",
            "name": "재발급대기",
            "cohort": 2024,
            "phone": "010-2000-3005",
        },
    )
    assert create_res.status_code == HTTPStatus.CREATED
    signup_id = create_res.json()["id"]

    res = admin_login.post(f"/admin/signup-requests/{signup_id}/reissue-token")
    assert res.status_code == HTTPStatus.CONFLICT
    body = res.json()
    assert body["code"] == "signup_request_not_approved"


def test_member_signup_phone_required_422(client: TestClient) -> None:
    response = client.post(
        "/auth/member/signup",
        json={
            "student_id": "s116008",
            "email": "s116008@test.example.com",
            "name": "전화없음",
            "cohort": 2024,
        },
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
