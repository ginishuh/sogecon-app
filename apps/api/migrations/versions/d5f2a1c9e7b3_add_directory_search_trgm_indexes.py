"""add selected directory search trigram indexes

Revision ID: d5f2a1c9e7b3
Revises: c8a7f3d1e2b4
Create Date: 2026-08-02 00:00:00.000000

검색 workload와 PostgreSQL plan 측정 결과에 따라 부분문자열 검색의
선택도가 충분한 student_id와 company만 추가한다. major와 industry는
현실적인 분포에서 선택도가 낮아 GIN 인덱스를 추가하지 않는다.
"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d5f2a1c9e7b3"
down_revision: str | None = "c8a7f3d1e2b4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # pg_trgm은 기존 migration에서 생성되지만, 이 migration만 재적용해도
    # extension 계약이 명시되도록 유지한다. 운영 계정이 extension을 만들
    # 권한이 없으면 migration을 진행하지 않고 명시적으로 실패한다.
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # CREATE INDEX CONCURRENTLY는 트랜잭션 밖에서만 가능하다. IF NOT EXISTS는
    # 재시도 시 이미 성공한 개별 인덱스를 보존하지만, invalid index는 운영자가
    # catalog에서 확인하고 정리한 뒤 재시도해야 한다.
    with op.get_context().autocommit_block():
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_members_student_id_trgm "
            "ON members USING gin (student_id gin_trgm_ops)"
        )
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_members_company_trgm "
            "ON members USING gin (company gin_trgm_ops)"
        )


def downgrade() -> None:
    # 인덱스만 제거하며 pg_trgm extension은 기존 5개 인덱스가 계속 사용하므로
    # 제거하지 않는다. downgrade도 CONCURRENTLY 제약을 동일하게 지킨다.
    with op.get_context().autocommit_block():
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_members_company_trgm")
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_members_student_id_trgm")
