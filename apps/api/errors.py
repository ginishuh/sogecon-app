from __future__ import annotations

"""
도메인 계층에서 사용하는 예외 정의.
HTTP 의존성을 제거하기 위해 서비스/리포지토리에서는 이 예외만 발생시키고,
라우터에서 HTTPException으로 매핑한다.
"""


class NotFoundError(Exception):
    """요청한 리소스를 찾을 수 없음."""


class AlreadyExistsError(Exception):
    """중복 생성 등으로 리소스가 이미 존재함."""


class ConflictError(Exception):
    """상태 충돌(예: 정원 초과, 상태 전이 불가 등)."""

