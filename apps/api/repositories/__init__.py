"""
Repository layer for database operations
"""


def escape_like(value: str) -> str:
    """LIKE 패턴의 와일드카드 문자(%, _)를 이스케이프한다.

    SQLAlchemy ilike() 사용 시 escape='\\' 와 함께 사용:
        column.ilike(f"%{escape_like(q)}%", escape="\\")
    """
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")