"use client";

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import Link from 'next/link';
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { listPosts, type Post } from '../../services/posts';
import { Tabs } from '../../components/ui/tabs';
import { formatBoardDate } from '../../lib/date-utils';

const BOARD_CATEGORIES = [
  { key: 'all', label: '전체' },
  { key: 'discussion', label: '자유' },
  { key: 'question', label: '질문' },
  { key: 'share', label: '정보' },
  { key: 'congrats', label: '경조사' },
] as const;

type BoardCategory = (typeof BOARD_CATEGORIES)[number]['key'];

const PAGE_SIZE = 10;
const BOARD_POST_CATEGORIES = ['discussion', 'question', 'share', 'congrats'] as const;

function BoardPageInner() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') ?? 'all').toLowerCase();
  const categoryKeys = BOARD_CATEGORIES.map((c) => c.key);
  const initialCategory: BoardCategory =
    (categoryKeys.includes(initialTab as BoardCategory) ? (initialTab as BoardCategory) :
      initialTab === 'free' ? 'discussion' : 'all');
  const [category, setCategory] = useState<BoardCategory>(initialCategory);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setPage(0);
  }, [category]);

  const query = useQuery<Post[]>({
    queryKey: ['board', category, page],
    queryFn: () => {
      const baseParams = { limit: PAGE_SIZE, offset: page * PAGE_SIZE };
      if (category === 'all') {
        return listPosts({ ...baseParams, categories: [...BOARD_POST_CATEGORIES] });
      }
      return listPosts({ ...baseParams, category });
    },
    // v5: 이전 페이지 데이터 유지(UX 끊김 방지)
    placeholderData: keepPreviousData,
  });

  const filtered = useMemo(() => {
    const data = query.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return data;
    return data.filter((post) => {
      const title = post.title?.toLowerCase() ?? '';
      const content = post.content?.toLowerCase() ?? '';
      return title.includes(term) || content.includes(term);
    });
  }, [query.data, search]);

  const selectedIndex = BOARD_CATEGORIES.findIndex((c) => c.key === category) ?? 0;

  return (
    <section className="relative mx-auto w-full max-w-3xl space-y-4 px-4 py-4 pb-24">
      <header className="flex items-center justify-between border-b border-neutral-border pb-3">
        <h1 className="text-lg font-semibold text-text-primary">게시판</h1>
      </header>

      <div className="flex items-center gap-2 border-b border-neutral-border">
        <Tabs
          aria-label="게시판 카테고리"
          className="flex-1"
          defaultIndex={selectedIndex}
          onChange={(i) => {
            const key = BOARD_CATEGORIES[i]?.key ?? 'all';
            setCategory(key);
          }}
          items={BOARD_CATEGORIES.map((t) => ({
            id: t.key,
            label: t.label,
            content: (
              <div className="space-y-3 pt-3">
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 rounded-full border border-neutral-border bg-surface-raised px-4 py-2 text-sm focus:border-brand-400 focus:bg-white focus:outline-hidden"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.currentTarget.value);
                      setPage(0);
                    }}
                    placeholder="검색"
                  />
                  <button
                    type="button"
                    className="rounded-full border border-neutral-border bg-white px-4 py-2 text-sm text-text-secondary hover:bg-surface-raised"
                    onClick={() => setSearch('')}
                  >
                    초기화
                  </button>
                </div>

                {query.isLoading ? (
                  <p className="py-8 text-center text-sm text-text-muted">게시글을 불러오는 중입니다…</p>
                ) : null}
                {query.isError ? (
                  <p className="py-8 text-center text-sm text-state-error">게시글을 불러오지 못했습니다.</p>
                ) : null}
                {!query.isLoading && filtered.length === 0 ? (
                  <p className="py-12 text-center text-sm text-text-muted">
                    아직 등록된 게시글이 없습니다.
                  </p>
                ) : null}
                {filtered.length > 0 ? (
                  <ul className="space-y-2">
                    {filtered.map((post) => (
                      <li key={post.id}>
                        <Link
                          href={`/board/${post.id}`}
                          className="flex items-start gap-3 rounded-lg border border-neutral-border bg-white p-4 transition-colors hover:bg-surface-raised"
                        >
                          {post.category ? (
                            <span className="mt-0.5 inline-block rounded bg-brand-600 px-2 py-0.5 text-xs font-medium text-white">
                              {post.category}
                            </span>
                          ) : null}
                          <div className="flex-1 space-y-1">
                            <h3 className="text-body font-medium text-text-primary">
                              {post.pinned && <span className="mr-1">📌</span>}
                              {post.title}
                            </h3>
                            <div className="flex items-center gap-2 text-xs text-text-muted">
                              <span>{post.author_name || `회원${post.author_id}`}</span>
                              <span>·</span>
                              <span>{formatBoardDate(post.published_at)}</span>
                              <span>·</span>
                              <span>조회 {post.view_count ?? 0}</span>
                              <span>·</span>
                              <span>댓글 {post.comment_count ?? 0}</span>
                            </div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {!query.isLoading && filtered.length > 0 ? (
                  <div className="flex justify-center pt-4">
                    <button
                      type="button"
                      className="rounded-full border border-neutral-border bg-white px-6 py-2.5 text-sm text-text-secondary hover:bg-surface-raised disabled:opacity-40"
                      onClick={() => setPage((prev) => prev + 1)}
                      disabled={(query.data ?? []).length < PAGE_SIZE || query.isLoading}
                    >
                      더 불러오기
                    </button>
                  </div>
                ) : null}
              </div>
            ),
          }))}
        />
      </div>

      {/* FAB 글쓰기 버튼 */}
      <Link
        href="/board/new"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand-primary text-white shadow-lg transition-colors hover:bg-brand-primaryDark active:bg-brand-primaryDark"
        aria-label="새 글 작성"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </Link>
    </section>
  );
}

export default function BoardPage() {
  return (
    <Suspense fallback={<section className="mx-auto w-full max-w-3xl px-6 py-6 text-sm text-text-secondary">게시판을 불러오는 중…</section>}>
      <BoardPageInner />
    </Suspense>
  );
}
