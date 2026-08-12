"""RFC7807-lite Problem Details 모델·응답 helper."""

from __future__ import annotations

from typing import Any, cast

from pydantic import BaseModel

from .error_messages import user_detail_for_code


class ValidationErrorItem(BaseModel):
    type: str
    loc: list[str | int]
    msg: str
    input: Any | None = None
    ctx: dict[str, str] | None = None


class ProblemDetailsResponse(BaseModel):
    type: str = "about:blank"
    title: str = ""
    status: int
    detail: str
    code: str
    request_id: str | None = None
    errors: list[ValidationErrorItem] | None = None


def problem_details_body(
    *,
    status: int,
    code: str,
    detail: str,
    request_id: str | None = None,
    errors: list[dict[str, Any]] | None = None,
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
    if errors is not None:
        body["errors"] = errors
    return body


def json_safe_validation_errors(
    errors: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    safe: list[dict[str, Any]] = []
    for raw in errors:
        item = dict(raw)
        ctx = item.get("ctx")
        if isinstance(ctx, dict):
            ctx_map = cast(dict[Any, Any], ctx)
            item["ctx"] = {str(key): str(value) for key, value in ctx_map.items()}
        safe.append(item)
    return safe


def validation_problem(
    *,
    errors: list[dict[str, Any]],
    request_id: str | None = None,
) -> dict[str, object]:
    return problem_details_body(
        status=422,
        code="validation_error",
        detail=user_detail_for_code("validation_error", status=422),
        request_id=request_id,
        errors=json_safe_validation_errors(errors),
    )
