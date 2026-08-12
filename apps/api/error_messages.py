"""API 오류 code → 사용자 노출 detail (Web error-map과 정렬)."""

from __future__ import annotations

from http import HTTPStatus

# machine-readable code → 사용자에게 보여도 되는 한국어 detail
USER_FACING_DETAILS: dict[str, str] = {
    "login_failed": "학번 또는 비밀번호가 올바르지 않습니다.",
    "unauthorized": "로그인이 필요합니다.",
    "admin_permission_required": "이 작업을 수행할 운영 권한이 없습니다.",
    "admin_required": "운영자 권한이 필요합니다.",
    "super_admin_required": "최고 운영자 권한이 필요합니다.",
    "member_required": "회원 권한이 필요합니다.",
    "member_not_found": "회원 정보를 찾을 수 없습니다.",
    "member_not_active": (
        "아직 이용할 수 없는 계정입니다. 문의가 필요하면 사무국에 연락해 주세요."
    ),
    "member_pending_approval": (
        "동문회 사무국에서 가입 신청을 확인 중입니다. "
        "승인 안내를 받은 뒤 활성화를 진행해 주세요."
    ),
    "invalid_or_expired_activation_token": (
        "활성화 링크가 올바르지 않거나 만료되었습니다."
    ),
    "activation_already_used": "이미 사용된 활성화 링크입니다.",
    "post_not_found": "게시글을 찾을 수 없습니다.",
    "event_not_found": "행사를 찾을 수 없습니다.",
    "validation_error": "입력값을 확인해 주세요.",
    "rate_limit_exceeded": "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    "not_found": "요청한 경로를 찾을 수 없습니다.",
    "method_not_allowed": "허용되지 않은 요청 방식입니다.",
    "internal_error": "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    "http_error": "요청을 처리하지 못했습니다.",
}

_FRAMEWORK_DETAIL_CODES: dict[str, tuple[str, str]] = {
    "not found": ("not_found", USER_FACING_DETAILS["not_found"]),
    "method not allowed": (
        "method_not_allowed",
        USER_FACING_DETAILS["method_not_allowed"],
    ),
}


def looks_like_stable_code(text: str) -> bool:
    return " " not in text and text.replace("_", "").isalnum()


_STATUS_FALLBACK_CODES: dict[int, str] = {
    HTTPStatus.NOT_FOUND.value: "not_found",
    HTTPStatus.METHOD_NOT_ALLOWED.value: "method_not_allowed",
    HTTPStatus.TOO_MANY_REQUESTS.value: "rate_limit_exceeded",
    HTTPStatus.UNPROCESSABLE_ENTITY.value: "validation_error",
}


def user_detail_for_code(code: str, *, status: int) -> str:
    if code in USER_FACING_DETAILS:
        return USER_FACING_DETAILS[code]
    status_code = _STATUS_FALLBACK_CODES.get(status)
    if status_code is not None:
        return USER_FACING_DETAILS[status_code]
    if status >= HTTPStatus.INTERNAL_SERVER_ERROR:
        return USER_FACING_DETAILS["internal_error"]
    return USER_FACING_DETAILS["http_error"]


def public_problem_code_and_detail(
    *,
    status: int,
    code: str,
    detail: str | None = None,
) -> tuple[str, str]:
    """외부 Problem Details용 code/detail. 5xx는 항상 internal_error로 통일한다."""
    if status >= HTTPStatus.INTERNAL_SERVER_ERROR:
        return "internal_error", USER_FACING_DETAILS["internal_error"]
    resolved_detail = (
        detail
        if detail and detail != code
        else user_detail_for_code(code, status=status)
    )
    return code, resolved_detail


def code_and_detail_from_http_detail(
    detail: object,
    *,
    status: int,
) -> tuple[str, str]:
    if status >= HTTPStatus.INTERNAL_SERVER_ERROR:
        return public_problem_code_and_detail(status=status, code="internal_error")
    if isinstance(detail, str) and detail.strip():
        text = detail.strip()
        lowered = text.lower()
        framework = _FRAMEWORK_DETAIL_CODES.get(lowered)
        if framework is not None:
            return framework
        if looks_like_stable_code(text):
            return public_problem_code_and_detail(
                status=status,
                code=text,
                detail=user_detail_for_code(text, status=status),
            )
        return public_problem_code_and_detail(
            status=status,
            code="http_error",
            detail=text,
        )
    return public_problem_code_and_detail(status=status, code="http_error")
