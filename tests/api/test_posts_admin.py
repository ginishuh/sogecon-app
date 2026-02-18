"""게시물 관리 API 테스트 (수정, 삭제, 관리자 목록)."""

from __future__ import annotations

from http import HTTPStatus

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def anyio_backend() -> str:
    return "asyncio"


def _create_post(admin_login: TestClient, title: str = "테스트 게시물") -> dict:
    """테스트용 게시물 생성 헬퍼."""
    payload = {"title": title, "content": "본문 내용", "category": "notice"}
    res = admin_login.post("/posts/", json=payload)
    assert res.status_code == HTTPStatus.CREATED
    return res.json()


class TestPostUpdate:
    """게시물 수정 API 테스트."""

    def test_admin_can_update_post(self, admin_login: TestClient) -> None:
        """관리자는 게시물을 수정할 수 있다."""
        post = _create_post(admin_login)
        post_id = post["id"]

        update_payload = {
            "title": "수정된 제목",
            "content": "수정된 본문",
            "pinned": True,
        }
        res = admin_login.patch(f"/posts/{post_id}", json=update_payload)

        assert res.status_code == HTTPStatus.OK
        body = res.json()
        assert body["title"] == "수정된 제목"
        assert body["content"] == "수정된 본문"
        assert body["pinned"] is True

    def test_admin_can_unpublish_post(self, admin_login: TestClient) -> None:
        """관리자는 게시물을 비공개로 전환할 수 있다."""
        # 먼저 공개 게시물 생성
        payload = {
            "title": "공개 게시물",
            "content": "본문",
            "category": "notice",
        }
        res = admin_login.post("/posts/", json=payload)
        assert res.status_code == HTTPStatus.CREATED
        post = res.json()
        post_id = post["id"]

        # 비공개로 전환
        res = admin_login.patch(f"/posts/{post_id}", json={"unpublish": True})
        assert res.status_code == HTTPStatus.OK
        body = res.json()
        assert body["published_at"] is None

    def test_update_requires_admin(self, admin_login: TestClient) -> None:
        """일반 회원은 게시물을 수정할 수 없다."""
        post = _create_post(admin_login)
        post_id = post["id"]

        # 관리자 로그아웃 후 멤버로 로그인
        admin_login.post("/auth/logout")
        admin_login.post(
            "/auth/member/login",
            json={"student_id": "member001", "password": "memberpass"},
        )

        res = admin_login.patch(
            f"/posts/{post_id}", json={"title": "회원이 수정 시도"}
        )
        assert res.status_code == HTTPStatus.UNAUTHORIZED

    def test_update_requires_auth(self, admin_login: TestClient) -> None:
        """비로그인 사용자는 게시물을 수정할 수 없다."""
        post = _create_post(admin_login)
        post_id = post["id"]

        # 로그아웃
        admin_login.post("/auth/logout")
        admin_login.post("/auth/member/logout")

        res = admin_login.patch(f"/posts/{post_id}", json={"title": "비로그인 수정"})
        assert res.status_code == HTTPStatus.UNAUTHORIZED

    def test_update_nonexistent_post(self, admin_login: TestClient) -> None:
        """존재하지 않는 게시물 수정 시 404 반환."""
        res = admin_login.patch("/posts/99999", json={"title": "없는 게시물"})
        assert res.status_code == HTTPStatus.NOT_FOUND


class TestPostDelete:
    """게시물 삭제 API 테스트."""

    def test_admin_can_delete_post(self, admin_login: TestClient) -> None:
        """관리자는 게시물을 삭제할 수 있다."""
        post = _create_post(admin_login)
        post_id = post["id"]

        res = admin_login.delete(f"/posts/{post_id}")
        assert res.status_code == HTTPStatus.OK
        body = res.json()
        assert body["ok"] is True
        assert body["deleted_id"] == post_id

        # 삭제 후 조회 시 404
        res = admin_login.get(f"/posts/{post_id}")
        assert res.status_code == HTTPStatus.NOT_FOUND

    def test_delete_requires_admin(self, admin_login: TestClient) -> None:
        """일반 회원은 게시물을 삭제할 수 없다."""
        post = _create_post(admin_login)
        post_id = post["id"]

        # 관리자 로그아웃 후 멤버로 로그인
        admin_login.post("/auth/logout")
        admin_login.post(
            "/auth/member/login",
            json={"student_id": "member001", "password": "memberpass"},
        )

        res = admin_login.delete(f"/posts/{post_id}")
        assert res.status_code == HTTPStatus.UNAUTHORIZED

    def test_delete_requires_auth(self, admin_login: TestClient) -> None:
        """비로그인 사용자는 게시물을 삭제할 수 없다."""
        post = _create_post(admin_login)
        post_id = post["id"]

        # 로그아웃
        admin_login.post("/auth/logout")
        admin_login.post("/auth/member/logout")

        res = admin_login.delete(f"/posts/{post_id}")
        assert res.status_code == HTTPStatus.UNAUTHORIZED

    def test_delete_nonexistent_post(self, admin_login: TestClient) -> None:
        """존재하지 않는 게시물 삭제 시 404 반환."""
        res = admin_login.delete("/posts/99999")
        assert res.status_code == HTTPStatus.NOT_FOUND


class TestAdminPostList:
    """관리자 게시물 목록 API 테스트."""

    def test_admin_can_list_all_posts(self, admin_login: TestClient) -> None:
        """관리자는 비공개 게시물을 포함한 모든 게시물을 조회할 수 있다."""
        # 공개 게시물 생성
        _create_post(admin_login, "공개 게시물")

        res = admin_login.get("/admin/posts/")
        assert res.status_code == HTTPStatus.OK
        body = res.json()
        assert "items" in body
        assert "total" in body
        assert isinstance(body["items"], list)
        assert body["total"] >= 1

    def test_admin_list_filter_by_category(self, admin_login: TestClient) -> None:
        """카테고리별 필터링이 동작한다."""
        admin_login.post(
            "/posts/",
            json={"title": "공지", "content": "본문", "category": "notice"},
        )
        admin_login.post(
            "/posts/",
            json={"title": "소식", "content": "본문", "category": "news"},
        )

        res = admin_login.get("/admin/posts/?category=notice")
        assert res.status_code == HTTPStatus.OK
        body = res.json()
        for item in body["items"]:
            assert item["category"] == "notice"

    def test_admin_list_filter_by_status(self, admin_login: TestClient) -> None:
        """공개/비공개 상태 필터링이 동작한다."""
        # 공개 게시물 생성 후 비공개로 전환
        post = _create_post(admin_login, "비공개 테스트")
        admin_login.patch(f"/posts/{post['id']}", json={"unpublish": True})

        res = admin_login.get("/admin/posts/?status=draft")
        assert res.status_code == HTTPStatus.OK
        body = res.json()
        for item in body["items"]:
            assert item["published_at"] is None

    def test_admin_list_search(self, admin_login: TestClient) -> None:
        """검색 기능이 동작한다."""
        admin_login.post(
            "/posts/",
            json={"title": "고유한검색어", "content": "본문", "category": "notice"},
        )

        res = admin_login.get("/admin/posts/?q=고유한검색어")
        assert res.status_code == HTTPStatus.OK
        body = res.json()
        assert body["total"] >= 1
        assert any("고유한검색어" in item["title"] for item in body["items"])

    def test_admin_list_requires_admin(self, member_login: TestClient) -> None:
        """일반 회원은 관리자 목록에 접근할 수 없다."""
        res = member_login.get("/admin/posts/")
        assert res.status_code == HTTPStatus.FORBIDDEN

    def test_admin_list_requires_auth(self, client: TestClient) -> None:
        """비로그인 사용자는 관리자 목록에 접근할 수 없다."""
        res = client.get("/admin/posts/")
        assert res.status_code == HTTPStatus.UNAUTHORIZED

    def test_admin_list_pagination(self, admin_login: TestClient) -> None:
        """페이지네이션이 동작한다."""
        # 여러 게시물 생성
        for i in range(5):
            _create_post(admin_login, f"페이지네이션 테스트 {i}")

        res = admin_login.get("/admin/posts/?limit=2&offset=0")
        assert res.status_code == HTTPStatus.OK
        body = res.json()
        assert len(body["items"]) <= 2

        res = admin_login.get("/admin/posts/?limit=2&offset=2")
        assert res.status_code == HTTPStatus.OK
        body2 = res.json()
        # 오프셋이 다르면 다른 결과
        if body["items"] and body2["items"]:
            assert body["items"][0]["id"] != body2["items"][0]["id"]
