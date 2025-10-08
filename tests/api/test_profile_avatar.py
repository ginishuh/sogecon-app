from __future__ import annotations

import os
from http import HTTPStatus
from io import BytesIO
from pathlib import Path

from fastapi.testclient import TestClient
from PIL import Image

from apps.api import config


def _make_image_bytes(size: tuple[int, int] = (600, 600)) -> bytes:
    image = Image.new("RGB", size, color=(240, 240, 240))
    buf = BytesIO()
    image.save(buf, format="JPEG")
    return buf.getvalue()


def test_me_avatar_requires_auth(client: TestClient) -> None:
    res = client.post(
        "/me/avatar",
        files={"avatar": ("avatar.jpg", b"fake", "image/jpeg")},
    )
    assert res.status_code == HTTPStatus.UNAUTHORIZED


def test_me_avatar_rejects_invalid_file(member_login: TestClient) -> None:
    res = member_login.post(
        "/me/avatar",
        files={"avatar": ("avatar.txt", b"not-an-image", "text/plain")},
    )
    assert res.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_me_avatar_upload_success(tmp_path, member_login: TestClient) -> None:
    media_dir = tmp_path / "media"
    media_dir.mkdir()

    previous_media_root = os.environ.get("MEDIA_ROOT")
    os.environ["MEDIA_ROOT"] = str(media_dir)
    try:
        config.reset_settings_cache()
        settings = config.get_settings()

        image_bytes = _make_image_bytes()
        res = member_login.post(
            "/me/avatar",
            files={"avatar": ("avatar.jpg", image_bytes, "image/jpeg")},
        )
        assert res.status_code == HTTPStatus.OK
        payload = res.json()
        assert payload["avatar_url"]

        relative = payload["avatar_url"].replace(
            settings.media_url_base.rstrip("/") + "/", "", 1
        )
        stored_path = Path(settings.media_root) / relative
        assert stored_path.exists()
        assert stored_path.stat().st_size <= settings.avatar_max_bytes
    finally:
        if previous_media_root is None:
            os.environ.pop("MEDIA_ROOT", None)
        else:
            os.environ["MEDIA_ROOT"] = previous_media_root
        config.reset_settings_cache()
