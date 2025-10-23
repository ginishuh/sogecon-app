"""sqlite: enforce lowercase enum labels via check constraints

Revision ID: f2b5a9b1cafe
Revises: 72d4bb051add
Create Date: 2025-10-23 22:20:00

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f2b5a9b1cafe"
down_revision = "72d4bb051add"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """SQLite 전용: ENUM 라벨을 소문자로 강제하는 CHECK 제약 재생성.

    - SQLite는 네이티브 ENUM이 없으므로 CHECK 제약으로 표현됩니다.
    - 초기 마이그레이션에서 대문자 라벨이 생성된 경우가 있어, 데이터/제약을 소문자로 정규화합니다.
    - 다른 방언(Postgres 등)에서는 본 마이그레이션을 건너뜁니다.
    """
    bind = op.get_bind()
    if bind.dialect.name != "sqlite":
        return

    # 1) 데이터 값을 소문자로 정규화
    op.execute(sa.text("UPDATE members SET visibility = lower(visibility) WHERE visibility IS NOT NULL"))
    op.execute(sa.text("UPDATE rsvps SET status = lower(status) WHERE status IS NOT NULL"))

    # 2) CHECK 제약(=Enum 표현)을 소문자 라벨로 재생성
    #    batch_alter_table은 SQLite에서 테이블 재작성 패턴을 적용합니다.
    with op.batch_alter_table("members") as batch_op:
        batch_op.alter_column(
            "visibility",
            existing_type=sa.Enum("ALL", "COHORT", "PRIVATE", name="visibility", native_enum=False),
            type_=sa.Enum("all", "cohort", "private", name="visibility", native_enum=False),
            existing_nullable=False,
        )

    with op.batch_alter_table("rsvps") as batch_op:
        batch_op.alter_column(
            "status",
            existing_type=sa.Enum("GOING", "WAITLIST", "CANCEL", name="rsvpstatus", native_enum=False),
            type_=sa.Enum("going", "waitlist", "cancel", name="rsvpstatus", native_enum=False),
            existing_nullable=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "sqlite":
        return

    # 역정규화: 다시 대문자 라벨로 복구 (필요한 경우)
    with op.batch_alter_table("rsvps") as batch_op:
        batch_op.alter_column(
            "status",
            existing_type=sa.Enum("going", "waitlist", "cancel", name="rsvpstatus", native_enum=False),
            type_=sa.Enum("GOING", "WAITLIST", "CANCEL", name="rsvpstatus", native_enum=False),
            existing_nullable=False,
        )

    with op.batch_alter_table("members") as batch_op:
        batch_op.alter_column(
            "visibility",
            existing_type=sa.Enum("all", "cohort", "private", name="visibility", native_enum=False),
            type_=sa.Enum("ALL", "COHORT", "PRIVATE", name="visibility", native_enum=False),
            existing_nullable=False,
        )

    op.execute(sa.text("UPDATE rsvps SET status = upper(status) WHERE status IS NOT NULL"))
    op.execute(sa.text("UPDATE members SET visibility = upper(visibility) WHERE visibility IS NOT NULL"))

