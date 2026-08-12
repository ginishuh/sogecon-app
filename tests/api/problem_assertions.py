"""Problem Details 응답 assertion helper."""

from __future__ import annotations

from apps.api.error_messages import USER_FACING_DETAILS


def assert_problem_code(body: dict[str, object], code: str) -> None:
    assert body["code"] == code
    expected_detail = USER_FACING_DETAILS.get(code)
    assert isinstance(body["detail"], str)
    if expected_detail is not None:
        assert body["detail"] == expected_detail
    else:
        assert body["detail"] != code
