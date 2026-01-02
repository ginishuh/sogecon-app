import os

import pytest

from apps.api import config
from apps.api.media_utils import (
    build_media_url,
    build_media_urls,
    normalize_media_path,
    normalize_media_paths,
)


@pytest.fixture
def media_base(monkeypatch):
    original = os.environ.get("MEDIA_URL_BASE")

    def _apply(value: str | None) -> None:
        if value is None:
            monkeypatch.delenv("MEDIA_URL_BASE", raising=False)
        else:
            monkeypatch.setenv("MEDIA_URL_BASE", value)
        config.reset_settings_cache()

    yield _apply

    if original is None:
        monkeypatch.delenv("MEDIA_URL_BASE", raising=False)
    else:
        monkeypatch.setenv("MEDIA_URL_BASE", original)
    config.reset_settings_cache()


def test_normalize_media_path_absolute_base_match(media_base) -> None:
    media_base("https://cdn.example.com/media")

    assert (
        normalize_media_path("https://cdn.example.com/media/images/a.jpg")
        == "images/a.jpg"
    )
    assert (
        normalize_media_path("https://cdn.example.com/media/images/a.jpg?x=1#frag")
        == "images/a.jpg?x=1#frag"
    )


def test_normalize_media_path_absolute_base_path_only(media_base) -> None:
    media_base("/media")

    assert (
        normalize_media_path("https://example.com/media/images/a.jpg")
        == "images/a.jpg"
    )


def test_normalize_media_path_absolute_external_keeps(media_base) -> None:
    media_base("https://cdn.example.com/media")

    assert (
        normalize_media_path("https://other.example.com/media/images/a.jpg")
        == "https://other.example.com/media/images/a.jpg"
    )


def test_normalize_media_path_relative_inputs(media_base) -> None:
    media_base("/media")

    assert normalize_media_path("/media/images/a.jpg") == "images/a.jpg"
    assert normalize_media_path("images/a.jpg") == "images/a.jpg"
    assert normalize_media_path("images/a.jpg?x=1#frag") == "images/a.jpg?x=1#frag"


def test_normalize_media_path_empty_returns_none(media_base) -> None:
    media_base("/media")

    assert normalize_media_path(None) is None
    assert normalize_media_path("") is None
    assert normalize_media_path("   ") is None


def test_normalize_media_paths_filters_blank(media_base) -> None:
    media_base("/media")

    values = ["/media/a.jpg", "", "  ", "https://other.com/x.jpg"]
    assert normalize_media_paths(values) == ["a.jpg", "https://other.com/x.jpg"]


def test_build_media_url_with_absolute_base(media_base) -> None:
    media_base("https://cdn.example.com/media")

    assert (
        build_media_url("images/a.jpg") == "https://cdn.example.com/media/images/a.jpg"
    )
    assert (
        build_media_url("https://other.example.com/media/images/a.jpg")
        == "https://other.example.com/media/images/a.jpg"
    )


def test_build_media_url_with_empty_base(media_base) -> None:
    media_base("")

    assert build_media_url("images/a.jpg") == "/images/a.jpg"


def test_build_media_urls_filters_blank(media_base) -> None:
    media_base("https://cdn.example.com/media")

    values = ["images/a.jpg", "", "  "]
    assert build_media_urls(values) == [
        "https://cdn.example.com/media/images/a.jpg"
    ]
