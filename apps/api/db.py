from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from .config import get_settings

settings = get_settings()


def create_app_engine(database_url: str) -> AsyncEngine:
    """운영 엔진 설정을 한 곳에서 만든다(psycopg3 async)."""
    return create_async_engine(
        database_url,
        pool_pre_ping=True,
        pool_size=20,
        max_overflow=10,
        pool_recycle=3600,
        # DB 오류 문자열의 바인딩 값(이메일·전화번호)이 로그·Sentry로 나가지 않게 한다.
        hide_parameters=True,
    )


async_engine: AsyncEngine = create_app_engine(settings.database_url)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI 의존성: 요청당 AsyncSession 제공."""
    async with AsyncSessionLocal() as session:
        yield session


# Annotated 타입 별칭 (pyright/ruff 경고 감소)
DbSession = Annotated[AsyncSession, Depends(get_db)]


@asynccontextmanager
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """시드 데이터 등을 위한 async 세션 컨텍스트 매니저."""
    async with AsyncSessionLocal() as session:
        yield session


async def dispose_engine() -> None:
    """앱 종료 시 커넥션 풀 정리."""
    await async_engine.dispose()
