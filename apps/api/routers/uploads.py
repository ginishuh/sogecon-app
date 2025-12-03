"""이미지 업로드 라우터."""

from __future__ import annotations

import io
import secrets
import time
from pathlib import Path

from fastapi import APIRouter, Depends, UploadFile
from PIL import Image
from pydantic import BaseModel

from ..config import get_settings
from ..errors import ApiError
from .auth import CurrentMember, require_member

router = APIRouter(prefix="/uploads", tags=["uploads"])

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


class ImageUploadResponse(BaseModel):
    """이미지 업로드 응답."""

    url: str
    filename: str


def _resize_image_if_needed(img: Image.Image, max_pixels: int) -> Image.Image:
    """이미지가 max_pixels보다 크면 리사이즈."""
    width, height = img.size
    if width <= max_pixels and height <= max_pixels:
        return img
    if width > height:
        new_width = max_pixels
        new_height = int(height * (max_pixels / width))
    else:
        new_height = max_pixels
        new_width = int(width * (max_pixels / height))
    return img.resize((new_width, new_height), Image.Resampling.LANCZOS)


@router.post("/images", response_model=ImageUploadResponse)
async def upload_image(
    file: UploadFile,
    _member: CurrentMember = Depends(require_member),
) -> ImageUploadResponse:
    """이미지 파일 업로드.

    - 인증된 회원만 접근 가능
    - 지원 형식: JPEG, PNG, WebP, GIF
    - 최대 크기: 5MB (설정 가능)
    - 자동 리사이즈: 1920px 이하로 조정
    - GIF: 애니메이션은 첫 프레임만 저장 (정지 이미지로 변환)
    """
    settings = get_settings()

    # 파일 타입 검증
    content_type = file.content_type or ""
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise ApiError(
            code="invalid_image_type",
            detail=f"지원하지 않는 이미지 형식입니다. ({content_type})",
            status=422,
        )

    # 확장자 검증
    original_filename = file.filename or "image.jpg"
    ext = Path(original_filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ApiError(
            code="invalid_image_extension",
            detail=f"지원하지 않는 확장자입니다. ({ext})",
            status=422,
        )

    # 파일 읽기 및 크기 검증
    file_bytes = await file.read()
    if len(file_bytes) > settings.image_max_upload_bytes:
        max_mb = settings.image_max_upload_bytes / 1_000_000
        raise ApiError(
            code="image_too_large",
            detail=f"이미지 크기가 {max_mb:.1f}MB를 초과했습니다.",
            status=422,
        )

    # 이미지 로드 및 리사이즈
    try:
        img = Image.open(io.BytesIO(file_bytes))
        img.load()  # 이미지 유효성 검증
    except Exception as exc:
        raise ApiError(
            code="invalid_image_data",
            detail="이미지 파일을 읽을 수 없습니다.",
            status=422,
        ) from exc

    img = _resize_image_if_needed(img, settings.image_max_pixels)

    # 저장 경로 설정
    media_root = Path(settings.media_root)
    storage_dir = media_root / "images"
    storage_dir.mkdir(parents=True, exist_ok=True)

    # 파일명 생성 (충돌 방지)
    timestamp = int(time.time())
    random_hex = secrets.token_hex(8)
    new_filename = f"{timestamp}_{random_hex}{ext}"
    file_path = storage_dir / new_filename

    # 저장 (형식별 처리)
    if ext == ".gif":
        # GIF: 애니메이션 보존을 위해 리사이즈된 첫 프레임만 저장
        img.save(file_path, format="GIF", optimize=True)
    elif ext in {".png", ".webp"}:
        # PNG/WebP: 투명도 유지
        img.save(file_path, quality=85, optimize=True)
    else:
        # JPEG: RGB 변환 필수
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        img.save(file_path, format="JPEG", quality=85, optimize=True)

    # URL 반환
    relative_path = f"images/{new_filename}"
    url = f"{settings.media_url_base}/{relative_path}"

    return ImageUploadResponse(url=url, filename=new_filename)
