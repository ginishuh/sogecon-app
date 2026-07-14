import importlib

import sqlalchemy as sa

from apps.api import models, models_support


def test_support_ticket_table_is_registered_for_alembic() -> None:
    assert models_support.SupportTicket.__table__ is models.Base.metadata.tables[
        "support_tickets"
    ]
    assert {"members", "posts", "events", "support_tickets"} <= set(
        models.Base.metadata.tables
    )


def test_support_permission_backfill_preserves_existing_admin_access() -> None:
    migration = importlib.import_module(
        "apps.api.migrations.versions.b8e6d1f4a2c7_backfill_admin_support_roles"
    )
    engine = sa.create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(
            sa.text(
                "CREATE TABLE members "
                "(id INTEGER PRIMARY KEY, roles VARCHAR NOT NULL)"
            )
        )
        connection.execute(
            sa.text("INSERT INTO members (id, roles) VALUES (:id, :roles)"),
            [
                {"id": 1, "roles": "member,admin,admin_posts"},
                {"id": 2, "roles": "member,admin,admin_support"},
                {"id": 3, "roles": "member"},
                {"id": 4, "roles": "member,admin_events"},
            ],
        )
        connection.execute(sa.text(migration.BACKFILL_ADMIN_SUPPORT_SQL))
        result = connection.execute(sa.text("SELECT id, roles FROM members"))
        rows = {int(row["id"]): str(row["roles"]) for row in result.mappings()}

    assert rows == {
        1: "member,admin,admin_posts,admin_support",
        2: "member,admin,admin_support",
        3: "member",
        4: "member,admin_events",
    }
