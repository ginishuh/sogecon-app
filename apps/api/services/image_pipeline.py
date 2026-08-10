"""Shared image validation and processing for uploads."""

from __future__ import annotations

import io
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, UnidentifiedImageError
from PIL.Image import DecompressionBombError

from ..errors import ApiError

_POST_CONTENT_TYPES = frozenset(
    {"image/jpeg", "image/png", "image/webp", "image/gif"}
)
_POST_EXTENSIONS = frozenset({".jpg", ".jpeg", ".png", ".webp", ".gif"})
_AVATAR_CONTENT_TYPES = frozenset({"image/jpeg", "image/png", "image/webp"})
_AVATAR_EXTENSIONS = frozenset({".jpg", ".jpeg", ".png", ".webp"})

_INITIAL_JPEG_QUALITY = 85
_MIN_JPEG_QUALITY = 50


@dataclass(frozen=True)
class ProcessedImage:
    data: bytes
    extension: str
    relative_subdir: str


@dataclass(frozen=True)
class ImagePipelineConfig:
    allowed_content_types: frozenset[str]
    allowed_extensions: frozenset[str]
    max_pixels: int
    decode_max_pixels: int
    allow_gif: bool
    jpeg_only: bool
    max_output_bytes: int | None = None


def post_image_config(
    *,
    max_pixels: int,
    decode_max_pixels: int,
) -> ImagePipelineConfig:
    return ImagePipelineConfig(
        allowed_content_types=_POST_CONTENT_TYPES,
        allowed_extensions=_POST_EXTENSIONS,
        max_pixels=max_pixels,
        decode_max_pixels=decode_max_pixels,
        allow_gif=True,
        jpeg_only=False,
        max_output_bytes=None,
    )


def avatar_image_config(
    *,
    max_pixels: int,
    decode_max_pixels: int,
    max_output_bytes: int,
) -> ImagePipelineConfig:
    return ImagePipelineConfig(
        allowed_content_types=_AVATAR_CONTENT_TYPES,
        allowed_extensions=_AVATAR_EXTENSIONS,
        max_pixels=max_pixels,
        decode_max_pixels=decode_max_pixels,
        allow_gif=False,
        jpeg_only=True,
        max_output_bytes=max_output_bytes,
    )


@dataclass(frozen=True)
class ImageProcessErrorCodes:
    invalid_data: str
    unsupported_format: str
    decode_too_large: str
    compress_failed: str = "avatar_compress_failed"


def validate_mime_and_extension(
    *,
    content_type: str,
    filename: str,
    config: ImagePipelineConfig,
    invalid_type_code: str,
    invalid_extension_code: str,
) -> str:
    normalized_type = (content_type or "").split(";", 1)[0].strip().lower()
    if normalized_type not in config.allowed_content_types:
        raise ApiError(
            code=invalid_type_code,
            detail=f"지원하지 않는 이미지 형식입니다. ({content_type})",
            status=422,
        )

    ext = Path(filename or "image.jpg").suffix.lower()
    if ext not in config.allowed_extensions:
        raise ApiError(
            code=invalid_extension_code,
            detail=f"지원하지 않는 확장자입니다. ({ext})",
            status=422,
        )
    if ext == ".gif" and not config.allow_gif:
        raise ApiError(
            code=invalid_extension_code,
            detail=f"지원하지 않는 확장자입니다. ({ext})",
            status=422,
        )
    return ext


def process_image_bytes(
    file_bytes: bytes,
    ext: str,
    *,
    config: ImagePipelineConfig,
    errors: ImageProcessErrorCodes,
) -> ProcessedImage:
    previous_max_pixels = Image.MAX_IMAGE_PIXELS
    Image.MAX_IMAGE_PIXELS = config.decode_max_pixels
    try:
        try:
            image = Image.open(io.BytesIO(file_bytes))
        except (
            UnidentifiedImageError,
            DecompressionBombError,
            OSError,
            SyntaxError,
            ValueError,
        ) as exc:
            raise ApiError(
                code=errors.invalid_data,
                detail="이미지 파일을 읽을 수 없습니다.",
                status=422,
            ) from exc

        if image.format not in {"JPEG", "PNG", "WEBP", "GIF"}:
            raise ApiError(
                code=errors.unsupported_format,
                detail="JPG, PNG, WEBP 형식만 업로드할 수 있습니다.",
                status=422,
            )
        if image.format == "GIF" and not config.allow_gif:
            raise ApiError(
                code=errors.unsupported_format,
                detail="JPG, PNG, WEBP 형식만 업로드할 수 있습니다.",
                status=422,
            )

        image.load()
        width, height = image.size
        if width * height > config.decode_max_pixels:
            raise ApiError(
                code=errors.decode_too_large,
                detail="이미지 해상도가 허용 범위를 초과했습니다.",
                status=422,
            )

        if config.jpeg_only:
            normalized = _normalize_for_avatar(image)
            data = _compress_to_jpeg(
                normalized,
                max_pixels=config.max_pixels,
                max_bytes=config.max_output_bytes or len(file_bytes),
                compress_failed_code=errors.compress_failed,
            )
            return ProcessedImage(
                data=data, extension=".jpg", relative_subdir="avatars"
            )

        image = _resize_if_needed(image, config.max_pixels)
        if ext == ".gif":
            out = io.BytesIO()
            image.save(out, format="GIF", optimize=True)
            data = out.getvalue()
        elif ext in {".png", ".webp"}:
            out = io.BytesIO()
            fmt = "PNG" if ext == ".png" else "WEBP"
            image.save(out, format=fmt, quality=85, optimize=True)
            data = out.getvalue()
        else:
            if image.mode in ("RGBA", "P"):
                image = image.convert("RGB")
            out = io.BytesIO()
            image.save(out, format="JPEG", quality=85, optimize=True)
            data = out.getvalue()
            if ext not in {".jpg", ".jpeg"}:
                ext = ".jpg"
        return ProcessedImage(data=data, extension=ext, relative_subdir="images")
    finally:
        Image.MAX_IMAGE_PIXELS = previous_max_pixels


def _resize_if_needed(img: Image.Image, max_pixels: int) -> Image.Image:
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


def _normalize_for_avatar(image: Image.Image) -> Image.Image:
    if image.mode not in {"RGB", "L", "RGBA"}:
        image = image.convert("RGBA")
    if image.mode == "RGBA":
        background = Image.new("RGBA", image.size, (255, 255, 255, 255))
        background.paste(image, mask=image.split()[-1])
        return background.convert("RGB")
    if image.mode != "RGB":
        return image.convert("RGB")
    return image


def _compress_to_jpeg(
    image: Image.Image,
    *,
    max_pixels: int,
    max_bytes: int,
    compress_failed_code: str,
) -> bytes:
    normalized = image.copy()
    normalized.thumbnail((max_pixels, max_pixels))

    buffer = io.BytesIO()
    quality = _INITIAL_JPEG_QUALITY
    while True:
        buffer.seek(0)
        buffer.truncate(0)
        normalized.save(buffer, format="JPEG", optimize=True, quality=quality)
        if buffer.tell() <= max_bytes or quality <= _MIN_JPEG_QUALITY:
            break
        quality -= 5

    data = buffer.getvalue()
    if len(data) > max_bytes:
        raise ApiError(
            code=compress_failed_code,
            detail="이미지를 허용 크기 이하로 압축할 수 없습니다.",
            status=422,
        )
    return data
