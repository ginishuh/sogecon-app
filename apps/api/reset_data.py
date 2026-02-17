#!/usr/bin/env python3
"""
Issue #113 전환용 데이터 리셋 커맨드.

회원/인증/신청 관련 데이터만 원타임으로 초기화하고,
운영 로그성 테이블은 보존한다.
"""

from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass
from typing import Final, cast

from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection, CursorResult
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.db import get_db_session

ALLOW_RESET_ENV: Final[str] = "ALLOW_DESTRUCTIVE_RESET"
ALLOW_RESET_VALUE: Final[str] = "1"


@dataclass(frozen=True)
class DeleteStep:
    table: str
    where_clause: str | None = None


@dataclass(frozen=True)
class ResetSummary:
    deleted_rows: dict[str, int]
    skipped_tables: list[str]
    preserved_tables: list[str]


# FK/의존성 안전 순서로 삭제한다.
DELETE_STEPS: Final[tuple[DeleteStep, ...]] = (
    DeleteStep("comments"),
    DeleteStep("posts"),
    DeleteStep("rsvps"),
    DeleteStep("member_auth"),
    DeleteStep("admin_users"),
    DeleteStep("notification_preferences"),
    DeleteStep("push_subscriptions", where_clause="member_id IS NOT NULL"),
    DeleteStep("signup_requests"),
    DeleteStep("members"),
)

ALLOWED_DELETE_TABLES: Final[frozenset[str]] = frozenset(
    step.table for step in DELETE_STEPS
)

PRESERVED_TABLES: Final[tuple[str, ...]] = (
    "notification_send_logs",
    "scheduled_notification_logs",
    "support_tickets",
    "events",
    "hero_items",
)


def _has_table(sync_conn: Connection, table_name: str) -> bool:
    return inspect(sync_conn).has_table(table_name)


def is_reset_allowed(value: str | None) -> bool:
    return value == ALLOW_RESET_VALUE


async def _table_exists(session: AsyncSession, table_name: str) -> bool:
    conn = await session.connection()
    return await conn.run_sync(_has_table, table_name)


def _build_delete_sql(step: DeleteStep) -> str:
    if step.table not in ALLOWED_DELETE_TABLES:
        raise ValueError(f"허용되지 않은 테이블: {step.table}")
    if step.where_clause:
        return f'DELETE FROM "{step.table}" WHERE {step.where_clause}'
    return f'DELETE FROM "{step.table}"'


def _normalize_rowcount(value: int | None) -> int:
    if value is None:
        return 0
    if value < 0:
        return 0
    return value


async def reset_transition_data(session: AsyncSession) -> ResetSummary:
    deleted_rows: dict[str, int] = {}
    skipped_tables: list[str] = []

    try:
        for step in DELETE_STEPS:
            if not await _table_exists(session, step.table):
                skipped_tables.append(step.table)
                continue
            result = await session.execute(text(_build_delete_sql(step)))
            cursor_result = cast(CursorResult[object], result)
            deleted_rows[step.table] = _normalize_rowcount(cursor_result.rowcount)
        await session.commit()
    except SQLAlchemyError:
        await session.rollback()
        raise

    return ResetSummary(
        deleted_rows=deleted_rows,
        skipped_tables=skipped_tables,
        preserved_tables=list(PRESERVED_TABLES),
    )


def _format_summary(summary: ResetSummary) -> str:
    lines: list[str] = []
    lines.append("✅ 전환 데이터 리셋 완료")
    lines.append("")
    lines.append("삭제된 테이블:")
    for table, count in summary.deleted_rows.items():
        lines.append(f"- {table}: {count} row(s)")
    if summary.skipped_tables:
        lines.append("")
        lines.append("스킵된 테이블(현재 스키마에 없음):")
        for table in summary.skipped_tables:
            lines.append(f"- {table}")
    lines.append("")
    lines.append("보존된 테이블:")
    for table in summary.preserved_tables:
        lines.append(f"- {table}")
    return "\n".join(lines)


def _guard_or_raise() -> None:
    current = os.getenv(ALLOW_RESET_ENV)
    if is_reset_allowed(current):
        return
    msg = (
        "파괴적 리셋 보호장치가 필요합니다. "
        f"{ALLOW_RESET_ENV}={ALLOW_RESET_VALUE} 로 실행하세요."
    )
    raise RuntimeError(msg)


async def async_main() -> None:
    _guard_or_raise()
    print("⚠️  전환 데이터 리셋을 시작합니다...")
    async with get_db_session() as session:
        summary = await reset_transition_data(session)
    print(_format_summary(summary))


def main() -> None:
    try:
        asyncio.run(async_main())
    except (RuntimeError, ValueError, OSError, SQLAlchemyError) as err:
        print(f"❌ 리셋 실패: {err}")
        raise SystemExit(1) from err


if __name__ == "__main__":
    main()
