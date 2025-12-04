"""APScheduler AsyncIOScheduler 타입 스텁."""

from collections.abc import Callable
from datetime import tzinfo
from typing import Any

from apscheduler.job import Job
from apscheduler.triggers.base import BaseTrigger

class AsyncIOScheduler:
    def __init__(self, timezone: tzinfo | None = None, **options: Any) -> None: ...
    def add_job(
        self,
        func: Callable[..., Any],
        trigger: BaseTrigger | None = None,
        args: tuple[Any, ...] | None = None,
        kwargs: dict[str, Any] | None = None,
        id: str | None = None,
        name: str | None = None,
        misfire_grace_time: int | None = None,
        coalesce: bool = True,
        max_instances: int = 1,
        next_run_time: Any = None,
        jobstore: str = "default",
        executor: str = "default",
        replace_existing: bool = False,
        **trigger_args: Any,
    ) -> Job: ...
    def start(self) -> None: ...
    def shutdown(self, wait: bool = True) -> None: ...
