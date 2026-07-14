"""backfill admin support roles

Revision ID: b8e6d1f4a2c7
Revises: e7b4c2d9a1f6
Create Date: 2026-07-14 11:10:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b8e6d1f4a2c7"
down_revision: str | None = "e7b4c2d9a1f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

BACKFILL_ADMIN_SUPPORT_SQL = """
UPDATE members
SET roles = roles || ',admin_support'
WHERE (',' || roles || ',') LIKE '%,admin,%'
  AND (',' || roles || ',') NOT LIKE '%,admin_support,%'
"""


def upgrade() -> None:
    # 권한 분리 전 모든 admin 계정이 보유했던 문의 조회 접근권을 보존한다.
    op.execute(sa.text(BACKFILL_ADMIN_SUPPORT_SQL))


def downgrade() -> None:
    # 백필 뒤 사용자가 직접 조정한 역할과 구분할 수 없어 역할 토큰은 보존한다.
    pass
