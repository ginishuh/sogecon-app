"""posts 리포지토리 단위 테스트."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import TYPE_CHECKING, cast

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api import models
from apps.api.db import get_db
from apps.api.main import app
from apps.api.repositories import posts as posts_repo

if TYPE_CHECKING:
    from fastapi.testclient import TestClient


@pytest.fixture()
async def db_session(client: TestClient) -> AsyncGenerator[AsyncSession, None]:
    """테스트용 DB 세션 fixture."""
    override = app.dependency_overrides.get(get_db)
    if override is None:
        raise RuntimeError("get_db override not found")
    gen = override()
    session = await gen.__anext__()
    try:
        yield session
    finally:
        # 세션 정리: async generator의 close를 호출해야 함
        try:
            await gen.aclose()
        except StopAsyncIteration:
            pass


async def _get_or_create_member(db: AsyncSession) -> models.Member:
    """테스트용 멤버를 가져오거나 생성합니다."""
    stmt = select(models.Member).where(
        models.Member.student_id == "test_repo_member"
    )
    result = await db.execute(stmt)
    member = result.scalars().first()
    if member is None:
        member = models.Member(
            student_id="test_repo_member",
            email="test_repo@example.com",
            name="TestRepoMember",
            cohort=1,
            roles="member",
        )
        db.add(member)
        await db.commit()
        await db.refresh(member)
    return member


class TestGetCommentCountsBatch:
    """get_comment_counts_batch 함수 테스트."""

    @pytest.mark.asyncio
    async def test_empty_list_returns_empty_dict(
        self, db_session: AsyncSession
    ) -> None:
        """빈 리스트 입력 시 빈 딕셔너리 반환."""
        result = await posts_repo.get_comment_counts_batch(db_session, [])
        assert result == {}

    @pytest.mark.asyncio
    async def test_posts_without_comments_not_in_result(
        self, db_session: AsyncSession
    ) -> None:
        """댓글이 없는 게시물은 결과에 포함되지 않음."""
        member = await _get_or_create_member(db_session)

        # 게시물 생성 (댓글 없음)
        post = models.Post(
            title="댓글 없는 게시물",
            content="테스트 본문",
            category="notice",
            author_id=member.id,
        )
        db_session.add(post)
        await db_session.commit()
        await db_session.refresh(post)

        post_id = cast(int, post.id)
        result = await posts_repo.get_comment_counts_batch(db_session, [post_id])

        # 댓글이 없으므로 결과에 포함되지 않음
        assert post_id not in result

    @pytest.mark.asyncio
    async def test_multiple_posts_with_comments(
        self, db_session: AsyncSession
    ) -> None:
        """여러 게시물의 댓글 수를 정확히 반환."""
        member = await _get_or_create_member(db_session)

        # 게시물 2개 생성
        post1 = models.Post(
            title="게시물1", content="본문1", category="notice", author_id=member.id
        )
        post2 = models.Post(
            title="게시물2", content="본문2", category="notice", author_id=member.id
        )
        db_session.add_all([post1, post2])
        await db_session.commit()
        await db_session.refresh(post1)
        await db_session.refresh(post2)

        post1_id = cast(int, post1.id)
        post2_id = cast(int, post2.id)
        member_id = cast(int, member.id)

        # post1에 댓글 3개, post2에 댓글 1개
        comments = [
            models.Comment(post_id=post1_id, content="댓글1-1", author_id=member_id),
            models.Comment(post_id=post1_id, content="댓글1-2", author_id=member_id),
            models.Comment(post_id=post1_id, content="댓글1-3", author_id=member_id),
            models.Comment(post_id=post2_id, content="댓글2-1", author_id=member_id),
        ]
        db_session.add_all(comments)
        await db_session.commit()

        result = await posts_repo.get_comment_counts_batch(
            db_session, [post1_id, post2_id]
        )

        assert result[post1_id] == 3
        assert result[post2_id] == 1

    @pytest.mark.asyncio
    async def test_mixed_posts_with_and_without_comments(
        self, db_session: AsyncSession
    ) -> None:
        """댓글이 있는 게시물과 없는 게시물이 섞인 경우."""
        member = await _get_or_create_member(db_session)

        # 게시물 2개 생성
        post_with = models.Post(
            title="댓글있음", content="본문", category="notice", author_id=member.id
        )
        post_without = models.Post(
            title="댓글없음", content="본문", category="notice", author_id=member.id
        )
        db_session.add_all([post_with, post_without])
        await db_session.commit()
        await db_session.refresh(post_with)
        await db_session.refresh(post_without)

        post_with_id = cast(int, post_with.id)
        post_without_id = cast(int, post_without.id)
        member_id = cast(int, member.id)

        # post_with에만 댓글 2개
        db_session.add_all([
            models.Comment(post_id=post_with_id, content="댓글1", author_id=member_id),
            models.Comment(post_id=post_with_id, content="댓글2", author_id=member_id),
        ])
        await db_session.commit()

        result = await posts_repo.get_comment_counts_batch(
            db_session, [post_with_id, post_without_id]
        )

        # 댓글이 있는 게시물만 결과에 포함
        assert result.get(post_with_id) == 2
        assert post_without_id not in result
