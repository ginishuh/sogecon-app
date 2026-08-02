#!/usr/bin/env python3
"""Run the authoritative PostgreSQL Alembic migration and drift gate."""

from __future__ import annotations

import argparse
import os
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from alembic.util.exc import CommandError
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

ROOT = Path(__file__).resolve().parents[2]
ALEMBIC_CONFIG = ROOT / "apps/api/alembic.ini"
EXPECTED_GIN_INDEXES = {
    "idx_members_name_trgm": "name gin_trgm_ops",
    "idx_members_email_trgm": "email gin_trgm_ops",
    "idx_members_addr_personal_trgm": "addr_personal gin_trgm_ops",
    "idx_members_addr_company_trgm": "addr_company gin_trgm_ops",
    "idx_members_job_title_trgm": "job_title gin_trgm_ops",
    "idx_members_student_id_trgm": "student_id gin_trgm_ops",
    "idx_members_company_trgm": "company gin_trgm_ops",
}


def _database_url() -> str:
    url = (
        os.environ.get("MIGRATION_GATE_DATABASE_URL")
        or os.environ.get("DATABASE_URL")
        or os.environ.get("TEST_DB_URL")
        or ""
    )
    if not url.startswith("postgresql+psycopg://"):
        raise SystemExit(
            "[migration-gate] DATABASE_URL must use postgresql+psycopg://"
        )
    return url


def _alembic_config(url: str) -> Config:
    os.environ["DATABASE_URL"] = url
    config = Config(str(ALEMBIC_CONFIG))
    config.set_main_option("sqlalchemy.url", url.replace("%", "%%"))
    return config


def _assert_empty_database(engine: Engine) -> None:
    with engine.connect() as connection:
        table_count = connection.execute(
            text(
                "SELECT count(*) FROM pg_catalog.pg_class AS c "
                "JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace "
                "WHERE n.nspname = 'public' "
                "AND c.relkind IN ('r', 'p')"
            )
        ).scalar_one()
        if int(table_count) != 0:
            raise SystemExit(
                "[migration-gate] --require-empty expected no public tables, "
                f"found {table_count}"
            )


def _assert_head_and_catalog(engine: Engine, config: Config) -> None:
    script = ScriptDirectory.from_config(config)
    heads = script.get_heads()
    if len(heads) != 1:
        raise SystemExit(f"[migration-gate] expected one Alembic head, found {heads}")

    with engine.connect() as connection:
        versions = list(
            connection.execute(
                text("SELECT version_num FROM alembic_version ORDER BY version_num")
            ).scalars()
        )
        if versions != heads:
            raise SystemExit(
                "[migration-gate] alembic_version does not match head: "
                f"current={versions}, head={heads}"
            )

        extension = connection.execute(
            text(
                "SELECT 1 FROM pg_catalog.pg_extension "
                "WHERE extname = 'pg_trgm'"
            )
        ).scalar_one_or_none()
        if extension != 1:
            raise SystemExit("[migration-gate] pg_trgm extension is missing")

        index_names = list(EXPECTED_GIN_INDEXES)
        rows = connection.execute(
            text(
                "SELECT indexname, indexdef "
                "FROM pg_catalog.pg_indexes "
                "WHERE schemaname = 'public' AND indexname = ANY(:names)"
            ),
            {"names": index_names},
        ).all()
        found = {
            str(name): " ".join(str(definition).lower().split())
            for name, definition in rows
        }
        missing = sorted(set(index_names) - set(found))
        if missing:
            raise SystemExit(f"[migration-gate] missing indexes: {missing}")
        invalid = [
            name
            for name, definition in found.items()
            if " using gin " not in definition
            or EXPECTED_GIN_INDEXES[name].lower() not in definition
        ]
        if invalid:
            raise SystemExit(
                "[migration-gate] invalid GIN index definitions: "
                f"{invalid}"
            )

    print(f"[migration-gate] alembic current=head: {heads[0]}")
    print("[migration-gate] pg_trgm and expected GIN indexes: present")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--require-empty",
        action="store_true",
        help="fail unless the public schema is empty before upgrade",
    )
    args = parser.parse_args()
    url = _database_url()
    config = _alembic_config(url)
    engine = create_engine(url, pool_pre_ping=True)
    try:
        if args.require_empty:
            _assert_empty_database(engine)
        print("[migration-gate] alembic upgrade head")
        command.upgrade(config, "head")
        print("[migration-gate] alembic check")
        try:
            command.check(config)
        except CommandError as exc:
            raise SystemExit(f"[migration-gate] schema drift detected: {exc}") from exc
        _assert_head_and_catalog(engine, config)
    finally:
        engine.dispose()
    print("[migration-gate] PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
