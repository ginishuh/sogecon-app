from __future__ import annotations

from datetime import UTC, datetime
from http import HTTPStatus

from fastapi.testclient import TestClient


def _iso(dt: datetime) -> str:
    return dt.astimezone(UTC).isoformat().replace("+00:00", "Z")


def test_hero_slides_post_and_event(admin_login: TestClient) -> None:
    client = admin_login

    # 게시글(공지) 생성: 공개 상태(published_at 과거)
    post_res = client.post(
        "/posts/",
        json={
            "title": "공지 제목",
            "content": "공지 본문",
            "category": "notice",
            "published_at": _iso(datetime(2020, 1, 1, tzinfo=UTC)),
            "pinned": False,
        },
    )
    assert post_res.status_code in (HTTPStatus.CREATED, HTTPStatus.OK)
    post_id = post_res.json()["id"]

    # 행사 생성
    evt_res = client.post(
        "/events/",
        json={
            "title": "행사 제목",
            "description": "행사 설명",
            "starts_at": _iso(datetime(2030, 1, 1, tzinfo=UTC)),
            "ends_at": _iso(datetime(2030, 1, 1, 1, tzinfo=UTC)),
            "location": "서울",
            "capacity": 100,
        },
    )
    assert evt_res.status_code in (HTTPStatus.CREATED, HTTPStatus.OK)
    event_id = evt_res.json()["id"]

    # 히어로 슬롯 2개 생성(행사를 PIN으로 상단)
    r1 = client.post(
        "/admin/hero/",
        json={
            "target_type": "post",
            "target_id": post_id,
            "enabled": True,
            "pinned": False,
        },
    )
    assert r1.status_code == HTTPStatus.CREATED
    r2 = client.post(
        "/admin/hero/",
        json={
            "target_type": "event",
            "target_id": event_id,
            "enabled": True,
            "pinned": True,
            "image_override": "https://example.com/hero.png",
        },
    )
    assert r2.status_code == HTTPStatus.CREATED

    # 공개 히어로 조회: pinned 이벤트가 먼저 온다
    hero = client.get("/hero/?limit=10")
    assert hero.status_code == HTTPStatus.OK
    slides = hero.json()
    assert isinstance(slides, list)
    assert len(slides) == 2
    assert slides[0]["target_type"] == "event"
    assert slides[0]["target_id"] == event_id
    assert slides[0]["href"] == f"/events/{event_id}"
    assert slides[1]["target_type"] == "post"
    assert slides[1]["target_id"] == post_id
    assert slides[1]["href"] == f"/posts/{post_id}"


def test_hero_include_unpublished_requires_admin(admin_login: TestClient) -> None:
    client = admin_login

    # draft 공지(미발행) 생성: published_at=None
    post_res = client.post(
        "/posts/",
        json={
            "title": "초안 공지",
            "content": "초안 본문",
            "category": "notice",
            "published_at": None,
            "pinned": False,
        },
    )
    assert post_res.status_code in (HTTPStatus.CREATED, HTTPStatus.OK)
    post_id = post_res.json()["id"]

    hero_item = client.post(
        "/admin/hero/",
        json={
            "target_type": "post",
            "target_id": post_id,
            "enabled": True,
        },
    )
    assert hero_item.status_code == HTTPStatus.CREATED

    # 기본 조회에서는 노출되지 않는다
    hero_public = client.get("/hero/?limit=10")
    assert hero_public.status_code == HTTPStatus.OK
    assert hero_public.json() == []

    # include_unpublished=true + 관리자 세션이면 노출된다
    hero_admin = client.get("/hero/?limit=10&include_unpublished=true")
    assert hero_admin.status_code == HTTPStatus.OK
    slides = hero_admin.json()
    assert len(slides) == 1
    assert slides[0]["target_id"] == post_id
    assert slides[0]["unpublished"] is True


def test_admin_hero_create_update_requires_target_exists(
    admin_login: TestClient,
) -> None:
    client = admin_login

    # create: invalid post target
    r1 = client.post(
        "/admin/hero/",
        json={"target_type": "post", "target_id": 999999, "enabled": True},
    )
    assert r1.status_code == HTTPStatus.NOT_FOUND
    assert r1.json().get("code") == "post_not_found"

    # create: invalid event target
    r2 = client.post(
        "/admin/hero/",
        json={"target_type": "event", "target_id": 999999, "enabled": True},
    )
    assert r2.status_code == HTTPStatus.NOT_FOUND
    assert r2.json().get("code") == "event_not_found"

    # seed a real post + hero item
    post_res = client.post(
        "/posts/",
        json={
            "title": "공지(업데이트 테스트)",
            "content": "본문",
            "category": "notice",
            "published_at": _iso(datetime(2020, 1, 1, tzinfo=UTC)),
            "pinned": False,
        },
    )
    assert post_res.status_code in (HTTPStatus.CREATED, HTTPStatus.OK)
    post_id = post_res.json()["id"]

    hero_item = client.post(
        "/admin/hero/",
        json={"target_type": "post", "target_id": post_id, "enabled": True},
    )
    assert hero_item.status_code == HTTPStatus.CREATED
    hero_item_id = hero_item.json()["id"]

    # update: invalid post target_id
    r3 = client.patch(
        f"/admin/hero/{hero_item_id}",
        json={"target_id": 999999},
    )
    assert r3.status_code == HTTPStatus.NOT_FOUND
    assert r3.json().get("code") == "post_not_found"

    # update: invalid event target_id
    r4 = client.patch(
        f"/admin/hero/{hero_item_id}",
        json={"target_type": "event", "target_id": 999999},
    )
    assert r4.status_code == HTTPStatus.NOT_FOUND
    assert r4.json().get("code") == "event_not_found"


def test_admin_hero_update_delete_success_and_not_found(
    admin_login: TestClient,
) -> None:
    client = admin_login

    post_res = client.post(
        "/posts/",
        json={
            "title": "공지(수정/삭제 테스트)",
            "content": "본문",
            "category": "notice",
            "published_at": _iso(datetime(2020, 1, 1, tzinfo=UTC)),
            "pinned": False,
        },
    )
    assert post_res.status_code in (HTTPStatus.CREATED, HTTPStatus.OK)
    post_id = post_res.json()["id"]

    hero_item = client.post(
        "/admin/hero/",
        json={"target_type": "post", "target_id": post_id, "enabled": True},
    )
    assert hero_item.status_code == HTTPStatus.CREATED
    hero_item_id = hero_item.json()["id"]

    # update success
    upd = client.patch(
        f"/admin/hero/{hero_item_id}",
        json={
            "pinned": True,
            "title_override": "오버라이드 제목",
            "description_override": "오버라이드 설명",
            "image_override": "https://example.com/hero-upd.png",
        },
    )
    assert upd.status_code == HTTPStatus.OK
    body = upd.json()
    assert body["id"] == hero_item_id
    assert body["pinned"] is True
    assert body["title_override"] == "오버라이드 제목"
    assert body["image_override"] == "https://example.com/hero-upd.png"

    # delete success
    d1 = client.delete(f"/admin/hero/{hero_item_id}")
    assert d1.status_code == HTTPStatus.OK
    assert d1.json()["ok"] is True
    assert d1.json()["deleted_id"] == hero_item_id

    # update not found
    upd_nf = client.patch("/admin/hero/999999", json={"enabled": False})
    assert upd_nf.status_code == HTTPStatus.NOT_FOUND
    assert upd_nf.json().get("code") == "hero_item_not_found"

    # delete not found
    d_nf = client.delete("/admin/hero/999999")
    assert d_nf.status_code == HTTPStatus.NOT_FOUND
    assert d_nf.json().get("code") == "hero_item_not_found"


def test_hero_skips_deleted_targets(admin_login: TestClient) -> None:
    client = admin_login

    post_res = client.post(
        "/posts/",
        json={
            "title": "공지(삭제 후 스킵)",
            "content": "본문",
            "category": "notice",
            "published_at": _iso(datetime(2020, 1, 1, tzinfo=UTC)),
            "pinned": False,
        },
    )
    assert post_res.status_code in (HTTPStatus.CREATED, HTTPStatus.OK)
    post_id = post_res.json()["id"]

    evt_res = client.post(
        "/events/",
        json={
            "title": "행사(삭제 후 스킵)",
            "description": "설명",
            "starts_at": _iso(datetime(2030, 1, 1, tzinfo=UTC)),
            "ends_at": _iso(datetime(2030, 1, 1, 1, tzinfo=UTC)),
            "location": "서울",
            "capacity": 100,
        },
    )
    assert evt_res.status_code in (HTTPStatus.CREATED, HTTPStatus.OK)
    event_id = evt_res.json()["id"]

    r1 = client.post(
        "/admin/hero/",
        json={"target_type": "post", "target_id": post_id, "enabled": True},
    )
    assert r1.status_code == HTTPStatus.CREATED
    r2 = client.post(
        "/admin/hero/",
        json={"target_type": "event", "target_id": event_id, "enabled": True},
    )
    assert r2.status_code == HTTPStatus.CREATED

    hero_before = client.get("/hero/?limit=10")
    assert hero_before.status_code == HTTPStatus.OK
    assert len(hero_before.json()) == 2

    del_post = client.delete(f"/posts/{post_id}")
    assert del_post.status_code == HTTPStatus.OK
    assert del_post.json().get("ok") is True

    del_event = client.delete(f"/admin/events/{event_id}")
    assert del_event.status_code == HTTPStatus.NO_CONTENT

    hero_after = client.get("/hero/?limit=10")
    assert hero_after.status_code == HTTPStatus.OK
    assert hero_after.json() == []
