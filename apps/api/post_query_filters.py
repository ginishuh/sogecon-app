"""게시글 목록 필터 TypedDict — repository·service·router 공용."""

from __future__ import annotations

from collections.abc import Sequence
from typing import TypedDict


class AdminPostFilters(TypedDict, total=False):
    category: str | None
    status: str | None
    q: str | None


class PublicPostFilters(TypedDict, total=False):
    category: str | None
    categories: Sequence[str] | None
    q: str | None
