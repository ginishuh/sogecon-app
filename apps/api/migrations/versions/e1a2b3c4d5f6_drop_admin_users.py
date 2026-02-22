"""admin_users 테이블 제거 및 credential 통합.

admin_users의 비밀번호를 member_auth로 이전한 뒤 테이블을 DROP한다.
기존 super_admin 계정은 member_auth를 통해 로그인 가능하게 된다.

Revision ID: e1a2b3c4d5f6
Revises: a3b7c9d2e1f4
Create Date: 2026-02-22
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e1a2b3c4d5f6"
down_revision: str | None = "a3b7c9d2e1f4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. 고아 레코드 방어: members에 없는 admin_users 학번이 있으면 마이그레이션 실패
    conn = op.get_bind()
    orphan_count = conn.execute(
        sa.text(
            "SELECT count(*) FROM admin_users au "
            "WHERE NOT EXISTS ("
            "  SELECT 1 FROM members m WHERE m.student_id = au.student_id"
            ")"
        )
    ).scalar_one()
    if orphan_count > 0:
        raise RuntimeError(
            f"admin_users에 members에 없는 레코드가 {orphan_count}건 존재합니다. "
            "마이그레이션 전에 해결해주세요."
        )

    # 2. admin_users → member_auth 비밀번호 이전 (MemberAuth 없는 경우만)
    conn.execute(
        sa.text(
            "INSERT INTO member_auth (member_id, student_id, password_hash) "
            "SELECT m.id, au.student_id, au.password_hash "
            "FROM admin_users au "
            "JOIN members m ON m.student_id = au.student_id "
            "WHERE NOT EXISTS ("
            "  SELECT 1 FROM member_auth ma WHERE ma.student_id = au.student_id"
            ")"
        )
    )

    # 3. admin_users 테이블 DROP
    op.drop_table("admin_users")


def downgrade() -> None:
    # one-way 주의: downgrade는 스키마만 복원한다.
    # member_auth로 이전된 password_hash는 admin_users로 자동 복원되지 않는다.
    # 역이전이 필요하면 별도 운영 스크립트로 수동 처리해야 한다.
    op.create_table(
        "admin_users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "student_id",
            sa.String(20),
            nullable=False,
            unique=True,
            index=True,
        ),
        sa.Column(
            "email",
            sa.String(255),
            nullable=True,
            unique=True,
            index=True,
        ),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
