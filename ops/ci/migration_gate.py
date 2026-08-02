#!/usr/bin/env python3
"""Run the authoritative PostgreSQL Alembic migration and drift gate."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import cast

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from alembic.util.exc import CommandError
from sqlalchemy import bindparam, create_engine, text
from sqlalchemy.engine import Connection, Engine, RowMapping

ROOT = Path(__file__).resolve().parents[2]
ALEMBIC_CONFIG = ROOT / "apps/api/alembic.ini"
EXPECTED_GIN_INDEXES = {
    "idx_members_name_trgm": {"table": "members", "column": "name"},
    "idx_members_email_trgm": {"table": "members", "column": "email"},
    "idx_members_addr_personal_trgm": {
        "table": "members",
        "column": "addr_personal",
    },
    "idx_members_addr_company_trgm": {
        "table": "members",
        "column": "addr_company",
    },
    "idx_members_job_title_trgm": {
        "table": "members",
        "column": "job_title",
    },
    "idx_members_student_id_trgm": {
        "table": "members",
        "column": "student_id",
    },
    "idx_members_company_trgm": {"table": "members", "column": "company"},
}
INDEX_CATALOG_QUERY = text(
    """
    SELECT
        index_class.relname AS index_name,
        table_class.relname AS table_name,
        access_method.amname AS access_method,
        array_agg(table_attribute.attname ORDER BY index_keys.ordinality)
            AS column_names,
        array_agg(operator_class.opcname ORDER BY index_keys.ordinality)
            AS operator_classes,
        index_meta.indisvalid,
        index_meta.indisready,
        index_meta.indislive
    FROM pg_catalog.pg_class AS index_class
    JOIN pg_catalog.pg_namespace AS index_namespace
      ON index_namespace.oid = index_class.relnamespace
    JOIN pg_catalog.pg_index AS index_meta
      ON index_meta.indexrelid = index_class.oid
    JOIN pg_catalog.pg_class AS table_class
      ON table_class.oid = index_meta.indrelid
    JOIN pg_catalog.pg_namespace AS table_namespace
      ON table_namespace.oid = table_class.relnamespace
    JOIN pg_catalog.pg_am AS access_method
      ON access_method.oid = index_class.relam
    LEFT JOIN LATERAL unnest(index_meta.indkey) WITH ORDINALITY
        AS index_keys(attnum, ordinality)
      ON TRUE
    LEFT JOIN pg_catalog.pg_attribute AS table_attribute
      ON table_attribute.attrelid = index_meta.indrelid
     AND table_attribute.attnum = index_keys.attnum
    LEFT JOIN LATERAL unnest(index_meta.indclass) WITH ORDINALITY
        AS operator_keys(opclass_oid, ordinality)
      ON operator_keys.ordinality = index_keys.ordinality
    LEFT JOIN pg_catalog.pg_opclass AS operator_class
      ON operator_class.oid = operator_keys.opclass_oid
     AND operator_class.opcmethod = access_method.oid
    WHERE index_class.relkind = 'i'
      AND index_namespace.nspname = 'public'
      AND table_namespace.nspname = 'public'
      AND index_class.relname IN :index_names
    GROUP BY
        index_class.relname,
        table_class.relname,
        access_method.amname,
        index_meta.indisvalid,
        index_meta.indisready,
        index_meta.indislive
    """
).bindparams(bindparam("index_names", expanding=True))


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


def _assert_alembic_head(connection: Connection, config: Config) -> str:
    script = ScriptDirectory.from_config(config)
    heads = script.get_heads()
    if len(heads) != 1:
        raise SystemExit(f"[migration-gate] expected one Alembic head, found {heads}")
    versions = [
        str(version)
        for version in connection.execute(
            text("SELECT version_num FROM alembic_version ORDER BY version_num")
        ).scalars()
    ]
    if versions != heads:
        raise SystemExit(
            "[migration-gate] alembic_version does not match head: "
            f"current={versions}, head={heads}"
        )
    return heads[0]


def _assert_pg_trgm(connection: Connection) -> None:
    extension = connection.execute(
        text(
            "SELECT 1 FROM pg_catalog.pg_extension "
            "WHERE extname = 'pg_trgm'"
        )
    ).scalar_one_or_none()
    if extension != 1:
        raise SystemExit("[migration-gate] pg_trgm extension is missing")


def _catalog_array(row: RowMapping, key: str) -> list[str]:
    values = cast(list[object] | None, row[key])
    return [str(value) for value in values or []]


def _index_problems(index_name: str, row: RowMapping) -> list[str]:
    expected = EXPECTED_GIN_INDEXES[index_name]
    problems: list[str] = []
    if row["table_name"] != expected["table"]:
        problems.append(f"table={row['table_name']!r}")
    columns = _catalog_array(row, "column_names")
    if columns != [expected["column"]]:
        problems.append(f"columns={columns!r}")
    if row["access_method"] != "gin":
        problems.append(f"method={row['access_method']!r}")
    operator_classes = _catalog_array(row, "operator_classes")
    if operator_classes != ["gin_trgm_ops"]:
        problems.append(f"opclasses={operator_classes!r}")
    for flag in ("indisvalid", "indisready", "indislive"):
        if not bool(row[flag]):
            problems.append(f"{flag}=false")
    return problems


def _assert_index_catalog(connection: Connection) -> None:
    index_names = list(EXPECTED_GIN_INDEXES)
    rows: list[RowMapping] = list(
        connection.execute(
            INDEX_CATALOG_QUERY,
            {"index_names": index_names},
        )
        .mappings()
        .all()
    )
    found = {str(row["index_name"]): row for row in rows}
    missing = sorted(set(index_names) - set(found))
    if missing:
        raise SystemExit(f"[migration-gate] missing indexes: {missing}")

    invalid: list[str] = []
    for index_name in EXPECTED_GIN_INDEXES:
        problems = _index_problems(index_name, found[index_name])
        if problems:
            invalid.append(f"{index_name}: {', '.join(problems)}")
    if invalid:
        raise SystemExit(
            "[migration-gate] invalid expected index catalog state: "
            + "; ".join(invalid)
        )


def _assert_head_and_catalog(engine: Engine, config: Config) -> None:
    with engine.connect() as connection:
        head = _assert_alembic_head(connection, config)
        _assert_pg_trgm(connection)
        _assert_index_catalog(connection)

    print(f"[migration-gate] alembic current=head: {head}")
    print(
        "[migration-gate] pg_trgm and expected GIN indexes: "
        "present with valid/ready/live catalog state"
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--require-empty",
        action="store_true",
        help="fail unless the public schema is empty before upgrade",
    )
    mode.add_argument(
        "--readback-only",
        action="store_true",
        help="read Alembic and PostgreSQL catalog state without changing the DB",
    )
    args = parser.parse_args()
    url = _database_url()
    config = _alembic_config(url)
    engine = create_engine(url, pool_pre_ping=True)
    try:
        if args.readback_only:
            print(
                "[migration-gate] readback-only: skipping alembic upgrade and check"
            )
        else:
            if args.require_empty:
                _assert_empty_database(engine)
            print("[migration-gate] alembic upgrade head")
            command.upgrade(config, "head")
            print("[migration-gate] alembic check")
            try:
                command.check(config)
            except CommandError as exc:
                raise SystemExit(
                    f"[migration-gate] schema drift detected: {exc}"
                ) from exc
        _assert_head_and_catalog(engine, config)
    finally:
        engine.dispose()
    print("[migration-gate] PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
