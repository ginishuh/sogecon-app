"""async_client fixture를 사용한 async 경로 검증 테스트.

sync TestClient와 달리 httpx.AsyncClient는 실제 async 코드 경로를
테스트하여 await 누락 등의 오류를 잡아냅니다.
"""

from __future__ import annotations

from http import HTTPStatus

import httpx
import pytest


@pytest.mark.asyncio
async def test_healthz_async(async_client: httpx.AsyncClient) -> None:
    """async client로 healthz 엔드포인트 검증."""
    res = await async_client.get("/healthz")
    assert res.status_code == HTTPStatus.OK


@pytest.mark.asyncio
async def test_members_list_async(async_client: httpx.AsyncClient) -> None:
    """async client로 members 목록 조회 (인증 불필요 엔드포인트)."""
    res = await async_client.get("/members/?limit=5")
    assert res.status_code == HTTPStatus.OK
    assert isinstance(res.json(), list)


@pytest.mark.asyncio
async def test_posts_list_async(async_client: httpx.AsyncClient) -> None:
    """async client로 posts 목록 조회."""
    res = await async_client.get("/posts/?limit=5")
    assert res.status_code == HTTPStatus.OK
    assert isinstance(res.json(), list)


@pytest.mark.asyncio
async def test_events_list_async(async_client: httpx.AsyncClient) -> None:
    """async client로 events 목록 조회."""
    res = await async_client.get("/events/?limit=5")
    assert res.status_code == HTTPStatus.OK
    assert isinstance(res.json(), list)
