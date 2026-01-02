from __future__ import annotations

from urllib.parse import SplitResult, urlsplit

from .config import get_settings


def _trim_value(value: str | None) -> str | None:
    """문자열 입력을 정리하고 비어 있으면 None을 반환한다."""
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed if trimmed else None


def _is_absolute(value: str) -> bool:
    """스킴+호스트를 가진 절대 URL인지 판단한다."""
    parts = urlsplit(value)
    return bool(parts.scheme and parts.netloc)


def _path_under_base(path: str, base_path: str) -> bool:
    """경로가 base_path 자체 또는 그 하위인지 확인한다."""
    if not base_path:
        return True
    return path == base_path or path.startswith(f"{base_path}/")


def _strip_base_path(path: str, base_path: str) -> str:
    """base_path 접두를 제거하고 바로 뒤의 슬래시 하나만 제거한다."""
    if not base_path:
        return path
    if path == base_path:
        return ""
    suffix = path[len(base_path) :]
    return suffix[1:] if suffix.startswith("/") else suffix


def _strip_leading_slashes(path: str) -> str:
    """선행 슬래시는 모두 제거해 상대경로로 맞춘다."""
    while path.startswith("/"):
        path = path[1:]
    return path


def _append_query_fragment(path: str, *, query: str, fragment: str) -> str:
    """경로에 query/fragment를 합쳐 반환한다."""
    if query:
        path = f"{path}?{query}"
    if fragment:
        path = f"{path}#{fragment}"
    return path


def _get_media_base_parts() -> tuple[SplitResult, str]:
    """MEDIA_URL_BASE를 파싱해 (parts, path)로 반환한다."""
    base = get_settings().media_url_base.strip().rstrip("/")
    parts = urlsplit(base)
    base_path = parts.path.rstrip("/")
    return parts, base_path


def _normalize_relative_path(path: str, base_path: str) -> str:
    """상대 경로를 정규화한다(기준 경로 제거 + 선행 슬래시 제거)."""
    rel = path
    if base_path and _path_under_base(path, base_path):
        rel = _strip_base_path(path, base_path)
    return _strip_leading_slashes(rel)


def _normalize_absolute_url(
    parts: SplitResult, base_parts: SplitResult, base_path: str
) -> str | None:
    """절대 URL이 기준과 일치하면 상대 경로로 변환한다."""
    if not (parts.scheme and parts.netloc):
        return None
    if base_parts.scheme and base_parts.netloc:
        if parts.scheme != base_parts.scheme or parts.netloc != base_parts.netloc:
            return None
        if not _path_under_base(parts.path, base_path):
            return None
        return _normalize_relative_path(parts.path, base_path)
    if base_path and _path_under_base(parts.path, base_path):
        return _normalize_relative_path(parts.path, base_path)
    return None


def normalize_media_path(value: str | None) -> str | None:
    """미디어 경로/URL을 상대경로로 정규화한다.

    - MEDIA_URL_BASE와 일치하는 절대 URL은 상대경로로 변환한다.
    - 외부 도메인 절대 URL은 변경하지 않는다.
    - 빈 문자열/공백은 None으로 처리한다.
    """
    trimmed = _trim_value(value)
    if trimmed is None:
        return None

    base_parts, base_path = _get_media_base_parts()
    parts = urlsplit(trimmed)
    query, fragment = parts.query, parts.fragment

    if parts.scheme and parts.netloc:
        rel = _normalize_absolute_url(parts, base_parts, base_path)
        if rel is None:
            return trimmed
        rel = _append_query_fragment(rel, query=query, fragment=fragment)
        return rel or None

    rel = _normalize_relative_path(parts.path, base_path)
    rel = _append_query_fragment(rel, query=query, fragment=fragment)
    return rel or None


def normalize_media_paths(values: list[str] | None) -> list[str] | None:
    """미디어 경로 배열을 정규화하고 빈 항목은 제거한다."""
    if values is None:
        return None
    normalized: list[str] = []
    for value in values:
        converted = normalize_media_path(value)
        if converted:
            normalized.append(converted)
    return normalized


def build_media_url(value: str | None) -> str | None:
    """상대 경로를 MEDIA_URL_BASE 기준 절대 URL로 변환한다."""
    trimmed = _trim_value(value)
    if trimmed is None:
        return None
    if _is_absolute(trimmed):
        return trimmed
    base = get_settings().media_url_base.strip().rstrip("/")
    if not base:
        return f"/{trimmed.lstrip('/')}"
    return f"{base}/{trimmed.lstrip('/')}"


def build_media_urls(values: list[str] | None) -> list[str] | None:
    """미디어 URL 배열을 구성하며 빈 항목은 제거한다."""
    if values is None:
        return None
    urls: list[str] = []
    for value in values:
        built = build_media_url(value)
        if built:
            urls.append(built)
    return urls
