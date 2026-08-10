"""Bounded upload reader unit tests."""

from __future__ import annotations

import io

import pytest
from fastapi import UploadFile
from starlette.datastructures import Headers

from apps.api.bounded_reader import read_bounded_upload
from apps.api.errors import ApiError


@pytest.mark.anyio("asyncio")
async def test_content_length_early_reject() -> None:
    upload = UploadFile(
        file=io.BytesIO(b"x" * 20),
        filename="big.jpg",
        headers=Headers({"content-length": "9999"}),
    )
    with pytest.raises(ApiError) as exc:
        await read_bounded_upload(
            upload, max_bytes=10, oversize_code="image_too_large"
        )
    assert exc.value.status == 413
    assert exc.value.code == "image_too_large"


@pytest.mark.anyio("asyncio")
async def test_stream_byte_count_authority_over_short_content_length() -> None:
    body = b"x" * 30
    upload = UploadFile(
        file=io.BytesIO(body),
        filename="spoof.jpg",
        headers=Headers({"content-length": "5"}),
    )
    with pytest.raises(ApiError) as exc:
        await read_bounded_upload(
            upload, max_bytes=20, oversize_code="image_too_large"
        )
    assert exc.value.status == 413


@pytest.mark.anyio("asyncio")
async def test_missing_content_length_still_enforces_limit() -> None:
    upload = UploadFile(
        file=io.BytesIO(b"x" * 50),
        filename="no-cl.jpg",
        headers=Headers({}),
    )
    with pytest.raises(ApiError) as exc:
        await read_bounded_upload(
            upload, max_bytes=10, oversize_code="image_too_large"
        )
    assert exc.value.status == 413
