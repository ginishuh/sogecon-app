from __future__ import annotations

import os
import subprocess
import sys
import uuid
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.engine.url import make_url
from sqlalchemy.exc import IntegrityError

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_TEST_DB_URL = "postgresql+psycopg://app:devpass@localhost:5434/appdb_test"


def _maintenance_url() -> str:
    configured = (
        os.environ.get("MIGRATION_GATE_REGRESSION_DATABASE_URL")
        or os.environ.get("TEST_DB_URL")
        or DEFAULT_TEST_DB_URL
    )
    url = make_url(configured)
    database = url.database or ""
    if "test" not in database and os.environ.get("TEST_DB_FORCE") != "1":
        raise RuntimeError(
            "migration gate regression requires a disposable test database; "
            "set TEST_DB_FORCE=1 only for an explicitly disposable target"
        )
    return url.set(database="postgres").render_as_string(hide_password=False)


def _run_gate(database_url: str, *arguments: str) -> subprocess.CompletedProcess[str]:
    environment = os.environ.copy()
    environment["MIGRATION_GATE_DATABASE_URL"] = database_url
    environment["DATABASE_URL"] = database_url
    return subprocess.run(
        [sys.executable, str(ROOT / "ops/ci/migration_gate.py"), *arguments],
        cwd=ROOT,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
        timeout=180,
    )


def _output(result: subprocess.CompletedProcess[str]) -> str:
    return f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"


def _drop_database(engine: Engine, database_name: str) -> None:
    with engine.connect() as connection:
        connection.execute(
            text(
                "SELECT pg_terminate_backend(pid) "
                "FROM pg_catalog.pg_stat_activity "
                "WHERE datname = :database_name AND pid <> pg_backend_pid()"
            ),
            {"database_name": database_name},
        )
        connection.execute(
            text(f'DROP DATABASE IF EXISTS "{database_name}"')
        )


def _inject_schema_drift(target: Engine) -> None:
    with target.begin() as connection:
        connection.execute(
            text(
                "ALTER TABLE public.members "
                "ADD COLUMN d5_regression_column integer"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE public.d5_regression_table "
                "(id integer PRIMARY KEY)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX d5_regression_index "
                "ON public.members (student_id)"
            )
        )


def _remove_schema_drift(target: Engine) -> None:
    with target.begin() as connection:
        connection.execute(text("DROP INDEX public.d5_regression_index"))
        connection.execute(
            text("ALTER TABLE public.members DROP COLUMN d5_regression_column")
        )
        connection.execute(text("DROP TABLE public.d5_regression_table"))


def _seed_duplicate_company_rows(target: Engine) -> None:
    with target.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO public.members "
                "(student_id, email, name, cohort, roles, status, visibility, "
                "company) "
                "VALUES "
                "('D5INVALID001', 'd5-invalid-1@example.com', 'D5 invalid one', "
                "'2020', ARRAY['member'], 'active', 'all', 'D5 invalid company'), "
                "('D5INVALID002', 'd5-invalid-2@example.com', 'D5 invalid two', "
                "'2021', ARRAY['member'], 'active', 'all', 'D5 invalid company')"
            )
        )


def _create_invalid_company_index(target: Engine) -> None:
    with target.execution_options(isolation_level="AUTOCOMMIT").connect() as connection:
        connection.execute(
            text(
                "DROP INDEX CONCURRENTLY IF EXISTS "
                "public.idx_members_company_trgm"
            )
        )
        with pytest.raises(IntegrityError):
            connection.execute(
                text(
                    "CREATE UNIQUE INDEX CONCURRENTLY idx_members_company_trgm "
                    "ON public.members USING btree (company)"
                )
            )


def _create_partial_company_index(target: Engine) -> None:
    with target.execution_options(isolation_level="AUTOCOMMIT").connect() as connection:
        connection.execute(
            text(
                "CREATE INDEX idx_members_company_trgm "
                "ON public.members USING gin "
                "(company gin_trgm_ops) WHERE false"
            )
        )


def _cleanup_invalid_company_index(target: Engine) -> None:
    with target.execution_options(isolation_level="AUTOCOMMIT").connect() as connection:
        connection.execute(
            text(
                "DROP INDEX CONCURRENTLY IF EXISTS "
                "public.idx_members_company_trgm"
            )
        )
    with target.begin() as connection:
        connection.execute(
            text(
                "DELETE FROM public.members "
                "WHERE student_id IN ('D5INVALID001', 'D5INVALID002')"
            )
        )


def test_repository_migration_gate_detects_postgresql_drift() -> None:
    """The repository Alembic environment must reject real PostgreSQL drift."""
    maintenance = create_engine(
        _maintenance_url(),
        isolation_level="AUTOCOMMIT",
        pool_pre_ping=True,
    )
    database_name = f"d5_migration_gate_{uuid.uuid4().hex[:12]}"
    target: Engine | None = None
    created = False
    try:
        with maintenance.connect() as connection:
            connection.execute(text(f'CREATE DATABASE "{database_name}"'))
        created = True
        configured_url = make_url(_maintenance_url()).set(database=database_name)
        database_url = configured_url.render_as_string(hide_password=False)

        initial = _run_gate(database_url, "--require-empty")
        assert initial.returncode == 0, _output(initial)

        readback = _run_gate(database_url, "--readback-only")
        assert readback.returncode == 0, _output(readback)
        assert "skipping alembic upgrade and check" in readback.stdout

        target = create_engine(database_url, pool_pre_ping=True)
        _inject_schema_drift(target)

        drift = _run_gate(database_url)
        assert drift.returncode != 0, _output(drift)
        drift_output = _output(drift)
        assert "d5_regression_column" in drift_output
        assert "d5_regression_table" in drift_output
        assert "d5_regression_index" in drift_output

        _remove_schema_drift(target)
        _seed_duplicate_company_rows(target)
        _create_invalid_company_index(target)

        invalid_index = _run_gate(database_url, "--readback-only")
        assert invalid_index.returncode != 0, _output(invalid_index)
        invalid_output = _output(invalid_index)
        assert "idx_members_company_trgm" in invalid_output
        assert (
            "indisvalid=false" in invalid_output
            or "method='btree'" in invalid_output
        )

        _cleanup_invalid_company_index(target)
        _create_partial_company_index(target)
        partial_index = _run_gate(database_url, "--readback-only")
        assert partial_index.returncode != 0, _output(partial_index)
        assert "full_index=false" in _output(partial_index)
    finally:
        if target is not None:
            _cleanup_invalid_company_index(target)
            target.dispose()
        if created:
            _drop_database(maintenance, database_name)
        maintenance.dispose()
