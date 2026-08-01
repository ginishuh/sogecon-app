from __future__ import annotations

from datetime import UTC, datetime, timedelta
from http import HTTPStatus

from fastapi.testclient import TestClient


def test_public_hides_notice_draft_and_future(admin_login: TestClient) -> None:
    past = (datetime.now(tz=UTC) - timedelta(days=1)).isoformat()
    future = (datetime.now(tz=UTC) + timedelta(days=3)).isoformat()

    published = admin_login.post(
        "/posts/",
        json={
            "title": "발행 공지",
            "content": "공개",
            "category": "notice",
            "published_at": past,
        },
    )
    assert published.status_code == HTTPStatus.CREATED
    published_id = published.json()["id"]

    draft = admin_login.post(
        "/posts/",
        json={
            "title": "초안 공지",
            "content": "비공개",
            "category": "notice",
            "published_at": None,
        },
    )
    assert draft.status_code == HTTPStatus.CREATED
    draft_id = draft.json()["id"]

    scheduled = admin_login.post(
        "/posts/",
        json={
            "title": "예약 공지",
            "content": "미래",
            "category": "news",
            "published_at": future,
        },
    )
    assert scheduled.status_code == HTTPStatus.CREATED
    scheduled_id = scheduled.json()["id"]

    # 관리자는 draft 상세 조회 가능
    admin_detail = admin_login.get(f"/posts/{draft_id}")
    assert admin_detail.status_code == HTTPStatus.OK
    assert admin_detail.json()["id"] == draft_id

    admin_list = admin_login.get("/admin/posts/?status=draft&limit=50")
    assert admin_list.status_code == HTTPStatus.OK
    admin_ids = {item["id"] for item in admin_list.json()["items"]}
    assert draft_id in admin_ids

    # 공개 클라이언트 검증을 위해 세션 쿠키 제거
    admin_login.cookies.clear()

    listed = admin_login.get("/posts/?limit=50&categories=notice&categories=news")
    assert listed.status_code == HTTPStatus.OK
    ids = {item["id"] for item in listed.json()}
    assert published_id in ids
    assert draft_id not in ids
    assert scheduled_id not in ids

    draft_res = admin_login.get(f"/posts/{draft_id}")
    assert draft_res.status_code == HTTPStatus.NOT_FOUND
    assert draft_res.json()["code"] == "post_not_found"
    assert admin_login.get(f"/posts/{scheduled_id}").status_code == HTTPStatus.NOT_FOUND


def test_board_null_published_remains_public(
    member_login: TestClient, client: TestClient
) -> None:
    created = member_login.post(
        "/posts/",
        json={
            "title": "보드 글",
            "content": "공개 유지",
            "category": "discussion",
        },
    )
    assert created.status_code == HTTPStatus.CREATED
    post_id = created.json()["id"]
    assert created.json()["published_at"] is None
    assert created.json()["view_count"] == 0

    listed = client.get("/posts/?limit=50&category=discussion")
    assert listed.status_code == HTTPStatus.OK
    assert any(item["id"] == post_id for item in listed.json())

    detail = client.get(f"/posts/{post_id}")
    assert detail.status_code == HTTPStatus.OK
    assert detail.json()["id"] == post_id


def test_create_ignores_client_view_count(admin_login: TestClient) -> None:
    res = admin_login.post(
        "/posts/",
        json={
            "title": "조회수 조작",
            "content": "본문",
            "category": "notice",
            "published_at": datetime.now(tz=UTC).isoformat(),
            "view_count": 999,
        },
    )
    assert res.status_code == HTTPStatus.CREATED
    assert res.json()["view_count"] == 0


def test_public_search_q_with_literal_wildcards(admin_login: TestClient) -> None:
    past = (datetime.now(tz=UTC) - timedelta(hours=1)).isoformat()
    target = admin_login.post(
        "/posts/",
        json={
            "title": "100%_exact",
            "content": "검색 대상",
            "category": "notice",
            "published_at": past,
        },
    )
    assert target.status_code == HTTPStatus.CREATED
    other = admin_login.post(
        "/posts/",
        json={
            "title": "다른 공지",
            "content": "무관",
            "category": "notice",
            "published_at": past,
        },
    )
    assert other.status_code == HTTPStatus.CREATED

    found = admin_login.get(
        "/posts/",
        params={"q": "100%_exact", "category": "notice", "limit": 20},
    )
    assert found.status_code == HTTPStatus.OK
    titles = [item["title"] for item in found.json()]
    assert "100%_exact" in titles
    assert "다른 공지" not in titles

    paged = admin_login.get(
        "/posts/",
        params={"q": "검색 대상", "category": "notice", "limit": 1, "offset": 0},
    )
    assert paged.status_code == HTTPStatus.OK
    assert len(paged.json()) <= 1
