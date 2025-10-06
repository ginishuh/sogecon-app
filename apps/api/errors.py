"""
도메인/서비스 계층에서 사용하는 API-무관 예외 계층.
필수: 안정적인 `code`를 포함해 프런트/클라이언트가 분기 가능하도록 한다.
전역 예외 핸들러가 HTTP 상태와 Problem Details(JSON)로 변환한다.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ApiError(Exception):
    code: str
    detail: str = ""
    status: int | None = None  # 권장 HTTP 상태(선택)

    def __str__(self) -> str:
        return self.detail or self.code


class NotFoundError(ApiError):
    def __init__(self, code: str = "not_found", detail: str = "") -> None:
        super().__init__(code=code, detail=detail, status=404)


class AlreadyExistsError(ApiError):
    def __init__(self, code: str = "already_exists", detail: str = "") -> None:
        super().__init__(code=code, detail=detail, status=409)


class ConflictError(ApiError):
    def __init__(self, code: str = "conflict", detail: str = "") -> None:
        super().__init__(code=code, detail=detail, status=409)
