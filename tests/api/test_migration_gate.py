from __future__ import annotations

from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import Column, Index, Integer, MetaData, String, Table, create_engine


def test_alembic_comparison_detects_normal_model_drift() -> None:
    """Normal column, table, and index drift must remain visible."""
    engine = create_engine("sqlite://")
    actual = MetaData()
    Table(
        "migration_gate_probe",
        actual,
        Column("id", Integer, primary_key=True),
        Column("existing_value", String(32)),
    )
    actual.create_all(engine)

    expected = MetaData()
    probe = Table(
        "migration_gate_probe",
        expected,
        Column("id", Integer, primary_key=True),
        Column("existing_value", String(32)),
        Column("unmigrated_column", String(32)),
    )
    Index("ix_migration_gate_probe_existing_value", probe.c.existing_value)
    Table("unmigrated_model_table", expected, Column("id", Integer, primary_key=True))

    with engine.connect() as connection:
        context = MigrationContext.configure(connection)
        changes = compare_metadata(context, expected)

    assert any(
        change[0] == "add_column"
        and getattr(change[3], "name", None) == "unmigrated_column"
        for change in changes
    )
    assert any(
        change[0] == "add_index"
        and getattr(change[1], "name", None)
        == "ix_migration_gate_probe_existing_value"
        for change in changes
    )
    assert any(
        change[0] == "add_table"
        and getattr(change[1], "name", None) == "unmigrated_model_table"
        for change in changes
    )
