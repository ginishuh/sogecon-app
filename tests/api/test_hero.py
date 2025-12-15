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
