"""UploadFile bounded read — stream byte count is the size authority."""

from __future__ import annotations

from fastapi import UploadFile

from .errors import ApiError

CHUNK_SIZE = 65_536


async def read_bounded_upload(
    upload: UploadFile,
    *,
    max_bytes: int,
    oversize_code: str,
    empty_code: str = "upload_empty",
) -> bytes:
    """Read an upload in fixed-size chunks without exceeding ``max_bytes``.

    ``Content-Length`` is used only for early reject when it exceeds the limit.
    The cumulative stream byte count is the final authority.
    """
    try:
        content_length = upload.headers.get("content-length")
        if content_length is not None:
            try:
                declared = int(content_length)
            except ValueError:
                declared = None
            if declared is not None and declared > max_bytes:
                raise ApiError(
                    code=oversize_code,
                    detail="업로드 파일 크기가 허용 범위를 초과했습니다.",
                    status=413,
                )

        chunks: list[bytes] = []
        total = 0
        while True:
            chunk = await upload.read(CHUNK_SIZE)
            if not chunk:
                break
            total += len(chunk)
            if total > max_bytes:
                raise ApiError(
                    code=oversize_code,
                    detail="업로드 파일 크기가 허용 범위를 초과했습니다.",
                    status=413,
                )
            chunks.append(chunk)

        data = b"".join(chunks)
        if not data:
            raise ApiError(
                code=empty_code,
                detail="이미지 파일이 비어 있습니다.",
                status=422,
            )
        return data
    finally:
        await upload.close()
