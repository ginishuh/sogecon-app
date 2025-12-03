"""이미지 업로드 API 테스트."""

from __future__ import annotations

import io
from http import HTTPStatus

from fastapi.testclient import TestClient
from PIL import Image


def test_upload_image_requires_auth(client: TestClient) -> None:
    """비인증 요청은 401 반환."""
    # 간단한 1x1 빨간 픽셀 이미지 생성
    img = Image.new("RGB", (1, 1), color="red")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)

    res = client.post(
        "/uploads/images",
        files={"file": ("test.jpg", buf, "image/jpeg")},
    )
    assert res.status_code == HTTPStatus.UNAUTHORIZED


def test_upload_image_success(member_login: TestClient) -> None:
    """인증된 회원은 이미지 업로드 가능."""
    # 100x100 테스트 이미지 생성
    img = Image.new("RGB", (100, 100), color="blue")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)

    res = member_login.post(
        "/uploads/images",
        files={"file": ("test.jpg", buf, "image/jpeg")},
    )
    assert res.status_code == HTTPStatus.OK
    data = res.json()
    assert "url" in data
    assert "filename" in data
    assert data["url"].startswith("/media/images/")
    assert data["filename"].endswith(".jpg")


def test_upload_image_invalid_type(member_login: TestClient) -> None:
    """지원하지 않는 파일 타입은 422 반환."""
    res = member_login.post(
        "/uploads/images",
        files={"file": ("test.txt", b"not an image", "text/plain")},
    )
    assert res.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    data = res.json()
    assert data.get("code") == "invalid_image_type"


def test_upload_image_png(member_login: TestClient) -> None:
    """PNG 이미지 업로드."""
    img = Image.new("RGBA", (50, 50), color=(255, 0, 0, 128))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    res = member_login.post(
        "/uploads/images",
        files={"file": ("test.png", buf, "image/png")},
    )
    assert res.status_code == HTTPStatus.OK
    data = res.json()
    assert data["filename"].endswith(".png")


def test_upload_image_gif(member_login: TestClient) -> None:
    """GIF 이미지 업로드 (정지 이미지로 저장)."""
    img = Image.new("RGB", (80, 80), color="green")
    buf = io.BytesIO()
    img.save(buf, format="GIF")
    buf.seek(0)

    res = member_login.post(
        "/uploads/images",
        files={"file": ("test.gif", buf, "image/gif")},
    )
    assert res.status_code == HTTPStatus.OK
    data = res.json()
    assert data["filename"].endswith(".gif")


def test_upload_image_resize_large(member_login: TestClient) -> None:
    """큰 이미지는 자동 리사이즈."""
    # 3000x2000 이미지 생성 (1920px 초과)
    img = Image.new("RGB", (3000, 2000), color="yellow")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=50)
    buf.seek(0)

    res = member_login.post(
        "/uploads/images",
        files={"file": ("large.jpg", buf, "image/jpeg")},
    )
    assert res.status_code == HTTPStatus.OK


def test_upload_image_invalid_extension(member_login: TestClient) -> None:
    """지원하지 않는 확장자는 422 반환."""
    img = Image.new("RGB", (10, 10), color="red")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)

    res = member_login.post(
        "/uploads/images",
        files={"file": ("test.bmp", buf, "image/jpeg")},  # 확장자 불일치
    )
    assert res.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    data = res.json()
    assert data.get("code") == "invalid_image_extension"
