"""add unique index to members phone

Revision ID: c7f4e2a9d1b3
Revises: b6d2e8f1c4a7
Create Date: 2026-02-20 00:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c7f4e2a9d1b3"
down_revision: str | None = "b6d2e8f1c4a7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 기존 데이터 안전화:
    # 1) 공백/빈 문자열은 NULL로 정규화
    # 2) 중복 phone은 id 기준 첫 행만 유지하고 나머지는 NULL 처리
    op.execute(
        sa.text(
            """
            UPDATE members
            SET phone = NULL
            WHERE phone IS NOT NULL AND TRIM(phone) = ''
            """
        )
    )
    op.execute(
        sa.text(
            """
            WITH ranked AS (
                SELECT id, ROW_NUMBER() OVER (PARTITION BY phone ORDER BY id) AS rn
                FROM members
                WHERE phone IS NOT NULL
            )
            UPDATE members
            SET phone = NULL
            WHERE id IN (
                SELECT id FROM ranked WHERE rn > 1
            )
            """
        )
    )
    op.create_index(op.f("ix_members_phone"), "members", ["phone"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_members_phone"), table_name="members")
