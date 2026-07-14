from pathlib import Path

from apps.api import models, models_support


def test_support_ticket_table_is_registered_for_alembic() -> None:
    assert models_support.SupportTicket.__table__ is models.Base.metadata.tables[
        "support_tickets"
    ]

    env_source = (
        Path(__file__).parents[2] / "apps" / "api" / "migrations" / "env.py"
    ).read_text(encoding="utf-8")
    assert "models_support" in env_source
