"""add pg_trgm extension and gin indexes for member search

Revision ID: e2143fa9dd96
Revises: eb357a33d715
Create Date: 2025-12-01 21:24:59.578638

pg_trgm + GIN 인덱스로 ILIKE '%keyword%' 패턴 검색 최적화
- 코드 변경 없이 기존 ilike 쿼리 그대로 인덱스 활용 가능
- lower() 함수 인덱스로 대소문자 무시 검색 지원
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

    # GIN 인덱스 생성 (CONCURRENTLY는 트랜잭션 내에서 불가하므로 일반 CREATE INDEX 사용)
    # 프로덕션에서 대용량 테이블이면 별도로 CONCURRENTLY 실행 권장
    op.execute(
        "CREATE INDEX idx_members_name_trgm ON members "
        "USING gin (lower(name) gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX idx_members_email_trgm ON members "
        "USING gin (lower(email) gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX idx_members_addr_personal_trgm ON members "
        "USING gin (lower(addr_personal) gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX idx_members_addr_company_trgm ON members "
        "USING gin (lower(addr_company) gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX idx_members_job_title_trgm ON members "
        "USING gin (lower(job_title) gin_trgm_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_members_job_title_trgm")
    op.execute("DROP INDEX IF EXISTS idx_members_addr_company_trgm")
    op.execute("DROP INDEX IF EXISTS idx_members_addr_personal_trgm")
    op.execute("DROP INDEX IF EXISTS idx_members_email_trgm")
    op.execute("DROP INDEX IF EXISTS idx_members_name_trgm")
    # 확장은 다른 곳에서 사용 중일 수 있으므로 제거하지 않음
