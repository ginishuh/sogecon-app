"""Upload protection regression tests (#255)."""

from __future__ import annotations

import asyncio
import io
from http import HTTPStatus
from pathlib import Path
from unittest.mock import patch

import bcrypt
import httpx
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError

from apps.api import config, models
from apps.api.db import get_db
from apps.api.main import app
from apps.api.models_upload import UploadAsset


def _jpeg_bytes(size: tuple[int, int] = (80, 80)) -> bytes:
    image = Image.new("RGB", size, color=(120, 80, 40))
    buf = io.BytesIO()
    image.save(buf, format="JPEG")
    return buf.getvalue()


def _png_bytes(size: tuple[int, int] = (80, 80)) -> bytes:
    image = Image.new("RGBA", size, color=(10, 20, 30, 255))
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()


def _webp_bytes(size: tuple[int, int] = (80, 80)) -> bytes:
    image = Image.new("RGB", size, color=(50, 60, 70))
    buf = io.BytesIO()
    image.save(buf, format="WEBP")
    return buf.getvalue()


def _upload_file(
    name: str = "test.jpg",
    data: bytes | None = None,
    content_type: str = "image/jpeg",
) -> dict:
    payload = data if data is not None else _jpeg_bytes()
    return {"file": (name, io.BytesIO(payload), content_type)}


def _seed_member002() -> None:
    override = app.dependency_overrides.get(get_db)
    if override is None:
        raise RuntimeError("get_db override not found")

    async def _run() -> None:
        async for db in override():
            existing = await db.execute(
                select(models.Member).where(models.Member.student_id == "member002")
            )
            if existing.scalars().first() is not None:
                return
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

    asyncio.run(_run())


def _asset_count() -> int:
    override = app.dependency_overrides.get(get_db)
    if override is None:
        raise RuntimeError("get_db override not found")

    async def _count() -> int:
        async for session in override():
            stmt = select(func.count(UploadAsset.id))
            return int((await session.execute(stmt)).scalar_one())

    return asyncio.run(_count())


@pytest.fixture()
def media_root(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    media_dir = tmp_path / "media"
    media_dir.mkdir()
    monkeypatch.setenv("MEDIA_ROOT", str(media_dir))
    config.reset_settings_cache()
    yield media_dir
    config.reset_settings_cache()


def test_upload_image_requires_auth(client: TestClient, media_root: Path) -> None:
    res = client.post("/uploads/images", files=_upload_file())
    assert res.status_code == HTTPStatus.UNAUTHORIZED


def test_upload_image_success_readback_db_and_fs(
    member_login: TestClient, media_root: Path
) -> None:
    res = member_login.post("/uploads/images", files=_upload_file())
    assert res.status_code == HTTPStatus.OK
    filename = res.json()["filename"]
    assert (media_root / "images" / filename).is_file()
    assert _asset_count() == 1


def test_upload_image_invalid_data(
    member_login: TestClient, media_root: Path
) -> None:
    res = member_login.post(
        "/uploads/images",
        files={"file": ("bad.jpg", io.BytesIO(b"not-an-image"), "image/jpeg")},
    )
    assert res.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert res.json().get("code") == "invalid_image_data"
    assert _asset_count() == 0


def test_upload_image_mime_extension_mismatch_rejected(
    member_login: TestClient, media_root: Path
) -> None:
    res = member_login.post(
        "/uploads/images",
        files=_upload_file(
            name="photo.bmp",
            data=_jpeg_bytes(),
            content_type="image/jpeg",
        ),
    )
    assert res.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert res.json().get("code") == "invalid_image_extension"


@pytest.mark.filterwarnings("ignore::PIL.Image.DecompressionBombWarning")
def test_upload_image_decode_pixels_exceeded(
    member_login: TestClient,
    media_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("IMAGE_DECODE_MAX_PIXELS", "10000")
    config.reset_settings_cache()
    data = _jpeg_bytes((101, 101))
    res = member_login.post("/uploads/images", files=_upload_file(data=data))
    assert res.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert res.json().get("code") == "image_decode_too_large"


def test_upload_image_exact_size_limit_ok_and_plus_one_413(
    member_login: TestClient,
    media_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    data = _jpeg_bytes((40, 40))
    limit = len(data)
    monkeypatch.setenv("IMAGE_MAX_UPLOAD_BYTES", str(limit))
    config.reset_settings_cache()
    ok = member_login.post("/uploads/images", files=_upload_file(data=data))
    assert ok.status_code == HTTPStatus.OK

    monkeypatch.setenv("IMAGE_MAX_UPLOAD_BYTES", str(limit - 1))
    config.reset_settings_cache()
    over = member_login.post(
        "/uploads/images",
        files=_upload_file(name="over.jpg", data=data),
    )
    assert over.status_code == HTTPStatus.REQUEST_ENTITY_TOO_LARGE


def test_upload_image_quota_bytes_exceeded(
    member_login: TestClient,
    media_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("IMAGE_QUOTA_COUNT", "10")
    monkeypatch.setenv("IMAGE_QUOTA_BYTES", "100000000")
    config.reset_settings_cache()

    data = _jpeg_bytes((60, 60))
    first = member_login.post("/uploads/images", files=_upload_file(data=data))
    assert first.status_code == HTTPStatus.OK
    stored_size = (media_root / "images" / first.json()["filename"]).stat().st_size

    monkeypatch.setenv("IMAGE_QUOTA_BYTES", str(stored_size + 10))
    config.reset_settings_cache()

    second = member_login.post(
        "/uploads/images",
        files=_upload_file(name="second.jpg", data=data),
    )
    assert second.status_code == HTTPStatus.CONFLICT
    assert second.json().get("code") == "image_quota_bytes_exceeded"


def test_upload_multiple_small_files_until_count_quota(
    member_login: TestClient,
    media_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("IMAGE_QUOTA_COUNT", "3")
    monkeypatch.setenv("IMAGE_QUOTA_BYTES", "100000000")
    config.reset_settings_cache()

    for index in range(3):
        res = member_login.post(
            "/uploads/images",
            files=_upload_file(name=f"small-{index}.jpg"),
        )
        assert res.status_code == HTTPStatus.OK

    blocked = member_login.post(
        "/uploads/images",
        files=_upload_file(name="one-too-many.jpg"),
    )
    assert blocked.status_code == HTTPStatus.CONFLICT
    assert blocked.json().get("code") == "image_quota_count_exceeded"
    assert _asset_count() == 3


def test_other_member_cannot_delete_foreign_asset(
    member_login: TestClient, media_root: Path
) -> None:
    _seed_member002()
    uploaded = member_login.post("/uploads/images", files=_upload_file())
    assert uploaded.status_code == HTTPStatus.OK
    filename = uploaded.json()["filename"]
    stored = media_root / "images" / filename
    assert stored.is_file()

    transport = httpx.ASGITransport(app=app, client=("7.7.7.7", 9010))
    async def _delete_as_other() -> httpx.Response:
        async with httpx.AsyncClient(
            transport=transport, base_url="http://local"
        ) as hc:
            login = await hc.post(
                "/auth/member/login",
                json={"student_id": "member002", "password": "memberpass2"},
            )
            assert login.status_code == HTTPStatus.OK
            return await hc.delete(f"/uploads/images/{filename}")

    res = asyncio.run(_delete_as_other())
    assert res.status_code == HTTPStatus.NO_CONTENT
    assert stored.is_file()
    assert _asset_count() == 1


def test_avatar_upload_png_and_webp(
    member_login: TestClient, media_root: Path
) -> None:
    for name, data, content_type in (
        ("avatar.png", _png_bytes(), "image/png"),
        ("avatar.webp", _webp_bytes(), "image/webp"),
    ):
        res = member_login.post(
            "/me/avatar",
            files={"avatar": (name, io.BytesIO(data), content_type)},
        )
        assert res.status_code == HTTPStatus.OK
        assert res.json()["avatar_url"]


def test_avatar_replace_removes_previous_file(
    member_login: TestClient, media_root: Path
) -> None:
    first = member_login.post(
        "/me/avatar",
        files={"avatar": ("a.jpg", io.BytesIO(_jpeg_bytes()), "image/jpeg")},
    )
    assert first.status_code == HTTPStatus.OK
    first_url = first.json()["avatar_url"]
    first_rel = first_url.split("/media/")[-1]
    first_path = media_root / first_rel

    second = member_login.post(
        "/me/avatar",
        files={"avatar": ("b.jpg", io.BytesIO(_jpeg_bytes((90, 90))), "image/jpeg")},
    )
    assert second.status_code == HTTPStatus.OK
    assert second.json()["avatar_url"] != first_url
    assert not first_path.exists()


def test_avatar_invalid_upload_preserves_existing(
    member_login: TestClient, media_root: Path
) -> None:
    ok = member_login.post(
        "/me/avatar",
        files={"avatar": ("good.jpg", io.BytesIO(_jpeg_bytes()), "image/jpeg")},
    )
    assert ok.status_code == HTTPStatus.OK
    before_url = ok.json()["avatar_url"]
    before_rel = before_url.split("/media/")[-1]
    before_path = media_root / before_rel
    assert before_path.is_file()

    bad = member_login.post(
        "/me/avatar",
        files={"avatar": ("bad.jpg", io.BytesIO(b"nope"), "image/jpeg")},
    )
    assert bad.status_code == HTTPStatus.UNPROCESSABLE_ENTITY

    me = member_login.get("/me/")
    assert me.status_code == HTTPStatus.OK
    assert me.json()["avatar_url"] == before_url
    assert before_path.is_file()


def test_upload_image_oversize_returns_413(
    member_login: TestClient, media_root: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("IMAGE_MAX_UPLOAD_BYTES", "500")
    config.reset_settings_cache()
    data = _jpeg_bytes((400, 400))
    res = member_login.post("/uploads/images", files=_upload_file(data=data))
    assert res.status_code == HTTPStatus.REQUEST_ENTITY_TOO_LARGE
    assert res.json().get("code") == "image_too_large"


def test_upload_image_empty_returns_422(
    member_login: TestClient, media_root: Path
) -> None:
    res = member_login.post(
        "/uploads/images",
        files={"file": ("empty.jpg", io.BytesIO(b""), "image/jpeg")},
    )
    assert res.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert res.json().get("code") == "image_empty"


def test_upload_image_quota_count_exceeded(
    member_login: TestClient,
    media_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("IMAGE_QUOTA_COUNT", "1")
    monkeypatch.setenv("IMAGE_QUOTA_BYTES", "100000000")
    config.reset_settings_cache()

    first = member_login.post("/uploads/images", files=_upload_file())
    assert first.status_code == HTTPStatus.OK

    second = member_login.post("/uploads/images", files=_upload_file(name="two.jpg"))
    assert second.status_code == HTTPStatus.CONFLICT
    assert second.json().get("code") == "image_quota_count_exceeded"


def test_upload_delete_returns_quota(
    member_login: TestClient,
    media_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("IMAGE_QUOTA_COUNT", "1")
    monkeypatch.setenv("IMAGE_QUOTA_BYTES", "100000000")
    config.reset_settings_cache()

    uploaded = member_login.post("/uploads/images", files=_upload_file())
    assert uploaded.status_code == HTTPStatus.OK
    filename = uploaded.json()["filename"]

    blocked = member_login.post(
        "/uploads/images",
        files=_upload_file(name="blocked.jpg"),
    )
    assert blocked.status_code == HTTPStatus.CONFLICT

    deleted = member_login.delete(f"/uploads/images/{filename}")
    assert deleted.status_code == HTTPStatus.NO_CONTENT

    again = member_login.post(
        "/uploads/images",
        files=_upload_file(name="after-delete.jpg"),
    )
    assert again.status_code == HTTPStatus.OK

    override = app.dependency_overrides.get(get_db)

    async def _count_assets() -> int:
        async for session in override():
            stmt = select(func.count(UploadAsset.id))
            return int((await session.execute(stmt)).scalar_one())

    assert asyncio.run(_count_assets()) == 1
    assert not (media_root / "images" / filename).exists()


def test_delete_image_idempotent(
    member_login: TestClient, media_root: Path
) -> None:
    uploaded = member_login.post("/uploads/images", files=_upload_file())
    filename = uploaded.json()["filename"]
    assert member_login.delete(f"/uploads/images/{filename}").status_code == 204
    assert member_login.delete(f"/uploads/images/{filename}").status_code == 204


def test_avatar_oversize_returns_413(
    member_login: TestClient, media_root: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("AVATAR_MAX_UPLOAD_BYTES", "200")
    config.reset_settings_cache()
    data = _jpeg_bytes((200, 200))
    res = member_login.post(
        "/me/avatar",
        files={"avatar": ("avatar.jpg", io.BytesIO(data), "image/jpeg")},
    )
    assert res.status_code == HTTPStatus.REQUEST_ENTITY_TOO_LARGE
    assert res.json().get("code") == "avatar_too_large"



@pytest.mark.anyio("asyncio")
async def test_upload_image_rate_limit_429(
    member_login: TestClient,
    media_root: Path,
    enable_rate_limit: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("RATE_LIMIT_IMAGE_UPLOAD", "2/minute")
    config.reset_settings_cache()

    transport = httpx.ASGITransport(app=app, client=("9.9.9.9", 9001))
    async with httpx.AsyncClient(transport=transport, base_url="http://local") as hc:
        login = await hc.post(
            "/auth/member/login",
            json={"student_id": "member001", "password": "memberpass"},
        )
        assert login.status_code == HTTPStatus.OK

        data = _jpeg_bytes()
        for _ in range(2):
            res = await hc.post(
                "/uploads/images",
                files={"file": ("a.jpg", data, "image/jpeg")},
            )
            assert res.status_code == HTTPStatus.OK

        blocked = await hc.post(
            "/uploads/images",
            files={"file": ("b.jpg", data, "image/jpeg")},
        )
        assert blocked.status_code == HTTPStatus.TOO_MANY_REQUESTS


@pytest.mark.anyio("asyncio")
async def test_concurrent_upload_quota_race(
    member_login: TestClient,
    media_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("IMAGE_QUOTA_COUNT", "1")
    monkeypatch.setenv("IMAGE_QUOTA_BYTES", "100000000")
    config.reset_settings_cache()

    transport = httpx.ASGITransport(app=app, client=("8.8.8.8", 9002))
    async with httpx.AsyncClient(transport=transport, base_url="http://local") as hc:
        login = await hc.post(
            "/auth/member/login",
            json={"student_id": "member001", "password": "memberpass"},
        )
        assert login.status_code == HTTPStatus.OK

        data = _jpeg_bytes()
        results = await asyncio.gather(
            hc.post(
                "/uploads/images",
                files={"file": ("race-a.jpg", data, "image/jpeg")},
            ),
            hc.post(
                "/uploads/images",
                files={"file": ("race-b.jpg", data, "image/jpeg")},
            ),
        )
        statuses = sorted(res.status_code for res in results)
        assert statuses.count(HTTPStatus.OK) == 1
        assert statuses.count(HTTPStatus.CONFLICT) == 1


def test_delete_image_db_failure_restores_file(
    member_login: TestClient, media_root: Path
) -> None:
    uploaded = member_login.post("/uploads/images", files=_upload_file())
    assert uploaded.status_code == HTTPStatus.OK
    filename = uploaded.json()["filename"]
    path = media_root / "images" / filename
    assert path.is_file()

    with patch(
        "apps.api.services.upload_service.upload_assets_repo.delete_asset",
        side_effect=SQLAlchemyError("db down"),
    ):
        try:
            member_login.delete(f"/uploads/images/{filename}")
        except SQLAlchemyError:
            pass

    assert path.is_file()
    assert _asset_count() == 1


def test_delete_image_unlink_failure_leaves_tombstone(
    member_login: TestClient, media_root: Path
) -> None:
    uploaded = member_login.post("/uploads/images", files=_upload_file())
    assert uploaded.status_code == HTTPStatus.OK
    filename = uploaded.json()["filename"]
    original = media_root / "images" / filename
    assert original.is_file()

    original_unlink = Path.unlink

    def unlink_tombstone_fails(self: Path, missing_ok: bool = False) -> None:
        if self.name.startswith(".delete_"):
            raise OSError("disk full")
        original_unlink(self, missing_ok=missing_ok)

    with patch.object(Path, "unlink", unlink_tombstone_fails):
        res = member_login.delete(f"/uploads/images/{filename}")

    assert res.status_code == HTTPStatus.NO_CONTENT
    assert _asset_count() == 0
    assert not original.exists()
    tombstones = list((media_root / "images").glob(f".delete_*_{filename}"))
    assert len(tombstones) == 1
    assert tombstones[0].is_file()


def test_admin_update_removes_author_upload_asset(
    member_login: TestClient, admin_login: TestClient, media_root: Path
) -> None:
    uploaded = member_login.post("/uploads/images", files=_upload_file())
    assert uploaded.status_code == HTTPStatus.OK
    body = uploaded.json()
    url = body["url"]
    filename = body["filename"]

    created = member_login.post(
        "/posts/",
        json={
            "title": "이미지 글",
            "content": "본문",
            "category": "discussion",
            "cover_image": url,
        },
    )
    assert created.status_code == HTTPStatus.CREATED
    post_id = created.json()["id"]
    assert _asset_count() == 1

    updated = admin_login.patch(
        f"/posts/{post_id}",
        json={"cover_image": None},
    )
    assert updated.status_code == HTTPStatus.OK
    assert updated.json()["cover_image"] is None
    assert _asset_count() == 0
    assert not (media_root / "images" / filename).exists()


@pytest.mark.anyio("asyncio")
async def test_avatar_upload_rate_limit_429(
    member_login: TestClient,
    media_root: Path,
    enable_rate_limit: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("RATE_LIMIT_AVATAR_UPLOAD", "1/minute")
    config.reset_settings_cache()

    transport = httpx.ASGITransport(app=app, client=("6.6.6.6", 9003))
    data = _jpeg_bytes()
    async with httpx.AsyncClient(transport=transport, base_url="http://local") as hc:
        login = await hc.post(
            "/auth/member/login",
            json={"student_id": "member001", "password": "memberpass"},
        )
        assert login.status_code == HTTPStatus.OK

        ok = await hc.post(
            "/me/avatar",
            files={"avatar": ("a.jpg", data, "image/jpeg")},
        )
        assert ok.status_code == HTTPStatus.OK

        blocked = await hc.post(
            "/me/avatar",
            files={"avatar": ("b.jpg", data, "image/jpeg")},
        )
        assert blocked.status_code == HTTPStatus.TOO_MANY_REQUESTS
