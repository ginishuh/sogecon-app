from __future__ import annotations

from urllib.parse import urlsplit

from .config import get_settings


def _trim_value(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed if trimmed else None


def _is_absolute(value: str) -> bool:
    parts = urlsplit(value)
    return bool(parts.scheme and parts.netloc)


def _path_under_base(path: str, base_path: str) -> bool:
    if not base_path:
        return True
    return path == base_path or path.startswith(f"{base_path}/")


def _strip_base_path(path: str, base_path: str) -> str:
    if not base_path:
        return path.lstrip("/")
    if path == base_path:
        return ""
    return path[len(base_path) :].lstrip("/")


def _append_query_fragment(path: str, *, query: str, fragment: str) -> str:
    if query:
        path = f"{path}?{query}"
    if fragment:
        path = f"{path}#{fragment}"
    return path


def normalize_media_path(value: str | None) -> str | None:
    trimmed = _trim_value(value)
    if trimmed is None:
        return None

    settings = get_settings()
    base = settings.media_url_base.strip().rstrip("/")
    base_parts = urlsplit(base)
    base_path = base_parts.path.rstrip("/")

    parts = urlsplit(trimmed)
    path = parts.path

    if parts.scheme and parts.netloc:
        if base_parts.scheme and base_parts.netloc:
            if (
                parts.scheme == base_parts.scheme
                and parts.netloc == base_parts.netloc
                and _path_under_base(path, base_path)
            ):
                rel = _strip_base_path(path, base_path)
                rel = _append_query_fragment(
                    rel, query=parts.query, fragment=parts.fragment
                )
                return rel or None
        elif base_path and _path_under_base(path, base_path):
            rel = _strip_base_path(path, base_path)
            rel = _append_query_fragment(rel, query=parts.query, fragment=parts.fragment)
            return rel or None
        return trimmed

    rel = path
    if base_path and _path_under_base(path, base_path):
        rel = _strip_base_path(path, base_path)
    rel = rel.lstrip("/")
    rel = _append_query_fragment(rel, query=parts.query, fragment=parts.fragment)
    return rel or None


def normalize_media_paths(values: list[str] | None) -> list[str] | None:
    if values is None:
        return None
    normalized: list[str] = []
    for value in values:
        converted = normalize_media_path(value)
        if converted:
            normalized.append(converted)
    return normalized


def build_media_url(value: str | None) -> str | None:
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
    if values is None:
        return None
    urls: list[str] = []
    for value in values:
        built = build_media_url(value)
        if built:
            urls.append(built)
    return urls
