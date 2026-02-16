import os
from importlib import import_module, reload

from apps.api import config


def test_media_url_base_absolute_mounts_media_path(monkeypatch) -> None:
    """MEDIA_URL_BASE가 절대 URL이어도 /media 경로로 정상 mount되는지 확인."""

    main_module = import_module("apps.api.main")
    original_media_url = os.environ.get("MEDIA_URL_BASE")

    try:
        monkeypatch.setenv("MEDIA_URL_BASE", "https://api.example.com/media")
        config.reset_settings_cache()
        main_module = reload(main_module)

        mounted_paths = {
            getattr(route, "path", None) for route in main_module.app.router.routes
        }
        assert "/media" in mounted_paths
    finally:
        # 환경 복원
        if original_media_url is None:
            monkeypatch.delenv("MEDIA_URL_BASE", raising=False)
        else:
            monkeypatch.setenv("MEDIA_URL_BASE", original_media_url)
        config.reset_settings_cache()
        reload(main_module)
