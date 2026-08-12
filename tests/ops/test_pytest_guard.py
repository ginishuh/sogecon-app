from __future__ import annotations

from ops.ci import pytest_guard


def test_evaluate_coupling_skips_without_api_changes() -> None:
    api_changes, error = pytest_guard.evaluate_coupling(["apps/web/page.tsx"])
    assert api_changes == []
    assert error is None


def test_evaluate_coupling_requires_test_updates_for_api_changes() -> None:
    api_changes, error = pytest_guard.evaluate_coupling(
        ["apps/api/services/comments_service.py"]
    )
    assert api_changes == ["apps/api/services/comments_service.py"]
    assert error is not None
    assert "without test updates" in error


def test_evaluate_coupling_passes_when_related_tests_change() -> None:
    api_changes, error = pytest_guard.evaluate_coupling(
        [
            "apps/api/services/comments_service.py",
            "tests/api/test_comments.py",
        ]
    )
    assert api_changes == ["apps/api/services/comments_service.py"]
    assert error is None


def test_evaluate_coupling_fails_with_unrelated_test_change() -> None:
    api_changes, error = pytest_guard.evaluate_coupling(
        [
            "apps/api/services/comments_service.py",
            "tests/api/test_auth.py",
        ]
    )
    assert api_changes == ["apps/api/services/comments_service.py"]
    assert error is not None
    assert "not covered by the changed tests" in error
    assert "apps/api/services/comments_service.py" in error


def test_test_change_covers_api_by_scheduler_content() -> None:
    assert pytest_guard.test_change_covers_api(
        "tests/api/test_scheduler.py",
        "apps/api/scheduler.py",
    )


def test_is_guarded_api_change_excludes_migrations() -> None:
    assert pytest_guard.is_guarded_api_change(
        "apps/api/migrations/versions/example.py"
    ) is False
    assert pytest_guard.is_guarded_api_change("apps/api/main.py") is True
