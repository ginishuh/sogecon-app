"""전화번호 숫자만 저장하도록 기존 데이터 정규화

Revision ID: a3b7c9d2e1f4
Revises: d8a1f3b5c7e9
Create Date: 2026-02-22 12:00:00.000000
"""

from alembic import op

revision = "a3b7c9d2e1f4"
down_revision = "d8a1f3b5c7e9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # members.phone — 하이픈/공백/+ 등 비숫자 제거
    op.execute(
        "UPDATE members SET phone = regexp_replace(phone, '[^0-9]', '', 'g') "
        "WHERE phone IS NOT NULL AND phone ~ '[^0-9]'"
    )
    # members.company_phone
    op.execute(
        "UPDATE members SET company_phone = regexp_replace(company_phone, '[^0-9]', '', 'g') "
        "WHERE company_phone IS NOT NULL AND company_phone ~ '[^0-9]'"
    )
    # signup_requests.phone
    op.execute(
        "UPDATE signup_requests SET phone = regexp_replace(phone, '[^0-9]', '', 'g') "
        "WHERE phone IS NOT NULL AND phone ~ '[^0-9]'"
    )


def downgrade() -> None:
    # 데이터 마이그레이션 — 원본 포맷 복원 불가, no-op
    pass
