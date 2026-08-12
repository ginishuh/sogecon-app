"""RFC7807-lite Problem Details 응답 body helper."""

from __future__ import annotations


def problem_details_body(
    *,
    status: int,
    code: str,
    detail: str,
    request_id: str | None = None,
) -> dict[str, object]:
    body: dict[str, object] = {
        "type": "about:blank",
        "title": "",
        "status": status,
        "detail": detail,
        "code": code,
    }
    if request_id:
        body["request_id"] = request_id
    return body


def code_from_http_detail(detail: object) -> tuple[str, str]:
    """HTTPException detail을 (code, user_detail)로 정규화한다."""
    if isinstance(detail, str) and detail.strip():
        text = detail.strip()
        if " " not in text and text.replace("_", "").isalnum():
            return text, text
        return "http_error", text
    return "http_error", "request failed"
