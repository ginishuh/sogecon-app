"""APScheduler IntervalTrigger 타입 스텁."""

from typing import Any

from .base import BaseTrigger

class IntervalTrigger(BaseTrigger):
    def __init__(self, **kwargs: Any) -> None: ...
