"""add pg_trgm extension and gin indexes for member search

Revision ID: e2143fa9dd96
Revises: eb357a33d715
Create Date: 2025-12-01 21:24:59.578638

pg_trgm + GIN 인덱스로 ILIKE '%keyword%' 패턴 검색 최적화
- pg_trgm GIN 인덱스는 ILIKE 연산자 직접 지원 (lower() 불필요)
- 코드 변경 없이 기존 ilike 쿼리 그대로 인덱스 활용 가능
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = 'e2143fa9dd96'
down_revision = 'eb357a33d715'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # pg_trgm 확장 생성 (superuser/owner 권한 필요)
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # GIN 인덱스 생성 — CONCURRENTLY로 무중단 적용
    # pg_trgm GIN은 ILIKE 연산자 직접 지원하므로 lower() 불필요
    # 주의: CONCURRENTLY는 트랜잭션 외부에서 실행해야 함
    with op.get_context().autocommit_block():
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_members_name_trgm "
            "ON members USING gin (name gin_trgm_ops)"
        )
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_members_email_trgm "
            "ON members USING gin (email gin_trgm_ops)"
        )
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_members_addr_personal_trgm "
            "ON members USING gin (addr_personal gin_trgm_ops)"
        )
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_members_addr_company_trgm "
            "ON members USING gin (addr_company gin_trgm_ops)"
        )
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_members_job_title_trgm "
            "ON members USING gin (job_title gin_trgm_ops)"
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_members_job_title_trgm")
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_members_addr_company_trgm")
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_members_addr_personal_trgm")
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_members_email_trgm")
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_members_name_trgm")
    # 확장은 다른 곳에서 사용 중일 수 있으므로 제거하지 않음
