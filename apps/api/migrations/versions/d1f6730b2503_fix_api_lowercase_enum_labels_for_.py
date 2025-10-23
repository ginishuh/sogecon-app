"""fix(api): lowercase enum labels for visibility/rsvp

Revision ID: d1f6730b2503
Revises: 559d5829569f
Create Date: 2025-10-23 16:00:48.550857

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd1f6730b2503'
down_revision = '559d5829569f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """PostgreSQL: ENUM 라벨을 대문자→소문자로 교체.

    Alembic autogenerate가 ENUM 값 변경을 감지하지 못하므로 수동 처리합니다.
    SQLite 등 비-Postgres에서는 CHECK 제약으로 생성되며, 새 모델이 이미 소문자 라벨을 사용하므로 변경 불필요.
    """
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    # visibility: 'ALL'|'COHORT'|'PRIVATE' → 'all'|'cohort'|'private'
    op.execute("ALTER TYPE visibility RENAME VALUE 'ALL' TO 'all'")
    op.execute("ALTER TYPE visibility RENAME VALUE 'COHORT' TO 'cohort'")
    op.execute("ALTER TYPE visibility RENAME VALUE 'PRIVATE' TO 'private'")

    # rsvpstatus: 'GOING'|'WAITLIST'|'CANCEL' → 'going'|'waitlist'|'cancel'
    op.execute("ALTER TYPE rsvpstatus RENAME VALUE 'GOING' TO 'going'")
    op.execute("ALTER TYPE rsvpstatus RENAME VALUE 'WAITLIST' TO 'waitlist'")
    op.execute("ALTER TYPE rsvpstatus RENAME VALUE 'CANCEL' TO 'cancel'")


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    # 역방향: 소문자 → 대문자
    op.execute("ALTER TYPE rsvpstatus RENAME VALUE 'cancel' TO 'CANCEL'")
    op.execute("ALTER TYPE rsvpstatus RENAME VALUE 'waitlist' TO 'WAITLIST'")
    op.execute("ALTER TYPE rsvpstatus RENAME VALUE 'going' TO 'GOING'")

    op.execute("ALTER TYPE visibility RENAME VALUE 'private' TO 'PRIVATE'")
    op.execute("ALTER TYPE visibility RENAME VALUE 'cohort' TO 'COHORT'")
    op.execute("ALTER TYPE visibility RENAME VALUE 'all' TO 'ALL'")
