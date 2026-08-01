from __future__ import annotations

from datetime import UTC, datetime, timedelta
from http import HTTPStatus

import pytest
from fastapi.testclient import TestClient

from apps.api.post_visibility import BOARD_POST_CATEGORIES


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

    # 관리자는 전용 preview API로 draft 상세 조회 가능
    admin_detail = admin_login.get(f"/admin/posts/{draft_id}/preview")
    assert admin_detail.status_code == HTTPStatus.OK
    assert admin_detail.json()["id"] == draft_id
    scheduled_preview = admin_login.get(f"/admin/posts/{scheduled_id}/preview")
    assert scheduled_preview.status_code == HTTPStatus.OK

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


def test_admin_public_detail_does_not_increment_view_count(
    admin_login: TestClient,
) -> None:
    published_at = (datetime.now(tz=UTC) - timedelta(hours=1)).isoformat()
    created = admin_login.post(
        "/posts/",
        json={
            "title": "관리자 조회수 제외",
            "content": "관리자 상세 확인",
            "category": "notice",
            "published_at": published_at,
        },
    )
    assert created.status_code == HTTPStatus.CREATED
    post_id = created.json()["id"]

    admin_detail = admin_login.get(f"/posts/{post_id}")
    assert admin_detail.status_code == HTTPStatus.OK
    assert admin_detail.json()["view_count"] == 0

    # 동일한 공개 상세를 익명 사용자가 열면 조회수는 정상 증가한다.
    admin_login.cookies.clear()
    public_detail = admin_login.get(f"/posts/{post_id}")
    assert public_detail.status_code == HTTPStatus.OK
    assert public_detail.json()["view_count"] == 1


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
    wildcard_bait = admin_login.post(
        "/posts/",
        json={
            "title": "1000Zexact",
            "content": "와일드카드면 매칭",
            "category": "notice",
            "published_at": past,
        },
    )
    assert wildcard_bait.status_code == HTTPStatus.CREATED
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
    assert "1000Zexact" not in titles
    assert "다른 공지" not in titles

    paged = admin_login.get(
        "/posts/",
        params={"q": "검색 대상", "category": "notice", "limit": 1, "offset": 0},
    )
    assert paged.status_code == HTTPStatus.OK
    assert len(paged.json()) <= 1


def test_create_rejects_unknown_category(member_login: TestClient) -> None:
    res = member_login.post(
        "/posts/",
        json={
            "title": "오타 카테고리",
            "content": "본문",
            "category": "discusion",
        },
    )
    assert res.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_create_rejects_missing_category(member_login: TestClient) -> None:
    res = member_login.post(
        "/posts/",
        json={
            "title": "카테고리 없음",
            "content": "본문",
        },
    )
    assert res.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


@pytest.mark.parametrize("category", ["notice", "news"])
def test_member_cannot_create_published_category(
    member_login: TestClient,
    admin_login: TestClient,
    category: str,
) -> None:
    # 두 fixture가 같은 TestClient를 공유하므로, 생성 요청 직전에 멤버 세션을
    # 명시해 관리자 fixture의 시드/로그인 효과가 섞이지 않게 한다.
    member_login.post(
        "/auth/member/login",
        json={"student_id": "member001", "password": "memberpass"},
    )
    title = f"회원 발행형 차단 {category}"
    res = member_login.post(
        "/posts/",
        json={"title": title, "content": "본문", "category": category},
    )
    assert res.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert res.json()["code"] == "invalid_post_category"

    admin_relogin = admin_login.post(
        "/auth/login",
        json={"student_id": "__seed__admin", "password": "__seed__"},
    )
    assert admin_relogin.status_code == HTTPStatus.OK
    listed = admin_login.get("/admin/posts/", params={"q": title, "limit": 20})
    assert listed.status_code == HTTPStatus.OK
    assert all(item["title"] != title for item in listed.json()["items"])


def test_update_category_is_optional_but_non_null_when_present(
    admin_login: TestClient,
) -> None:
    created = admin_login.post(
        "/posts/",
        json={
            "title": "수정 계약 테스트",
            "content": "본문",
            "category": "discussion",
        },
    )
    assert created.status_code == HTTPStatus.CREATED
    post_id = created.json()["id"]

    unchanged = admin_login.patch(
        f"/posts/{post_id}", json={"title": "수정 후에도 board"}
    )
    assert unchanged.status_code == HTTPStatus.OK
    assert unchanged.json()["category"] == "discussion"

    category_attempt = admin_login.patch(
        f"/posts/{post_id}", json={"category": "notice"}
    )
    assert category_attempt.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert category_attempt.json()["code"] == "board_category_immutable"

    null_category = admin_login.patch(
        f"/posts/{post_id}", json={"category": None}
    )
    assert null_category.status_code == HTTPStatus.UNPROCESSABLE_ENTITY

    unknown_category = admin_login.patch(
        f"/posts/{post_id}", json={"category": "discusion"}
    )
    assert unknown_category.status_code == HTTPStatus.UNPROCESSABLE_ENTITY

    published_draft = admin_login.post(
        "/posts/",
        json={
            "title": "발행형 초안",
            "content": "board 전환 금지",
            "category": "notice",
            "published_at": None,
        },
    )
    assert published_draft.status_code == HTTPStatus.CREATED
    draft_id = published_draft.json()["id"]
    board_attempt = admin_login.patch(
        f"/posts/{draft_id}", json={"category": "discussion"}
    )
    assert board_attempt.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert board_attempt.json()["code"] == "board_category_immutable"


def test_board_category_set_is_explicit() -> None:
    assert BOARD_POST_CATEGORIES == {
        "discussion",
        "question",
        "share",
        "congrats",
    }


def test_admin_hero_can_read_preview_without_post_management(
    admin_login: TestClient,
    set_seed_admin_roles,
) -> None:
    created = admin_login.post(
        "/posts/",
        json={
            "title": "hero 제한 관리자 초안",
            "content": "preview 본문",
            "category": "notice",
        },
    )
    assert created.status_code == HTTPStatus.CREATED
    post_id = created.json()["id"]

    set_seed_admin_roles("member,admin,admin_hero")
    relogin = admin_login.post(
        "/auth/login", json={"student_id": "__seed__admin", "password": "__seed__"}
    )
    assert relogin.status_code == HTTPStatus.OK

    preview = admin_login.get(f"/admin/posts/{post_id}/preview")
    assert preview.status_code == HTTPStatus.OK
    assert preview.json()["id"] == post_id
    assert admin_login.get("/admin/posts/").status_code == HTTPStatus.FORBIDDEN
    assert admin_login.get(f"/posts/{post_id}").status_code == HTTPStatus.NOT_FOUND

    create_attempt = admin_login.post(
        "/posts/",
        json={
            "title": "hero 제한 관리자 추가 시도",
            "content": "생성 거부",
            "category": "notice",
        },
    )
    assert create_attempt.status_code == HTTPStatus.FORBIDDEN
    assert create_attempt.json()["detail"] == "admin_permission_required"

    update_attempt = admin_login.patch(
        f"/posts/{post_id}", json={"title": "수정 거부"}
    )
    assert update_attempt.status_code == HTTPStatus.FORBIDDEN
    assert update_attempt.json()["detail"] == "admin_permission_required"

    delete_attempt = admin_login.delete(f"/posts/{post_id}")
    assert delete_attempt.status_code == HTTPStatus.FORBIDDEN
    assert delete_attempt.json()["detail"] == "admin_permission_required"
