"""가입 신청 접수·승인에서 같은 학번을 찾는 비교 규칙(한 곳에서 관리).

- 입력(앞뒤 공백 제거)이 ASCII뿐이면 학번 키로 비교한다: 공백 제거 → 소문자화 →
  맨 앞 `s` 한 글자 제거(`S90041` = `s90041` = `90041`). 저장 값에도 같은 규칙의
  SQL 식을 적용하되, ASCII 저장 값끼리만 비교해 PostgreSQL `lower`와 Python
  `lower`가 다른 문자가 결과에 끼어들지 않게 한다.
- 입력에 ASCII가 아닌 문자가 있으면(`학번모름`, `대학원 2019` 등) 변형
  매칭을 하지 않고 앞뒤 공백만 지운 원문 완전 일치로 비교한다.

저장된 학번 값은 바꾸지 않고, 로그인·활성화 경로는 기존 완전 일치를 유지한다.
"""

from __future__ import annotations

from sqlalchemy import and_, func
from sqlalchemy.sql.elements import ColumnElement

# SQL `translate`와 같은 ASCII 공백만 키에서 지운다.
_WHITESPACE = " \t\n\r\f\v"
_STRIP_WHITESPACE = str.maketrans("", "", _WHITESPACE)
# 저장 값 앞뒤에서 지우는 공백(SQL `btrim` 인자). 이메일 비교도 함께 쓴다.
EDGE_WHITESPACE = _WHITESPACE


def clean_student_id(raw: str) -> str:
    """저장·비교에 쓰는 신청 학번: 앞뒤 공백만 제거하고 내부 표기는 그대로 둔다."""
    return raw.strip()


def uses_student_id_key(student_id: str) -> bool:
    """학번 키(변형 매칭)를 쓰는 입력인지. ASCII가 아니면 원문 완전 일치."""
    return clean_student_id(student_id).isascii()


def student_id_key(student_id: str) -> str:
    """ASCII 학번의 비교 키: 공백 제거 → 소문자화 → 맨 앞 `s` 한 글자 제거."""
    compact = student_id.translate(_STRIP_WHITESPACE).lower()
    return compact[1:] if compact.startswith("s") else compact


def student_id_key_sql(column: ColumnElement[str]) -> ColumnElement[str]:
    """`student_id_key`와 같은 규칙의 PostgreSQL 식(ASCII 저장 값에만 쓴다)."""
    compact = func.translate(func.lower(column), _WHITESPACE, "")
    return func.regexp_replace(compact, "^s", "")


def student_id_match_clause(
    column: ColumnElement[str], student_id: str
) -> ColumnElement[bool]:
    """저장 학번 컬럼이 입력 학번과 같은 학번인지(접수·승인 공통 조회 조건)."""
    cleaned = clean_student_id(student_id)
    # 저장 값도 앞뒤 공백을 지운 뒤 비교한다(공백이 남은 기존 행 대비).
    stored = func.btrim(column, EDGE_WHITESPACE)
    if not uses_student_id_key(cleaned):
        return stored == cleaned
    # UTF-8 DB에서 바이트 길이 = 글자 수이면 ASCII 저장 값이다.
    return and_(
        func.octet_length(stored) == func.char_length(stored),
        student_id_key_sql(stored) == student_id_key(cleaned),
    )


def student_id_lock_name(student_id: str) -> str:
    """같은 학번의 접수·승인을 직렬화하는 advisory lock 이름."""
    cleaned = clean_student_id(student_id)
    if uses_student_id_key(cleaned):
        return f"signup:student:key:{student_id_key(cleaned)}"
    return f"signup:student:raw:{cleaned}"
