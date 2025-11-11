"use client";

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import Link from 'next/link';
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { listPosts, type Post } from '../../services/posts';
import { Tabs } from '../../components/ui/tabs';

const BOARD_CATEGORIES = [
  { key: 'all', label: '전체' },
  { key: 'discussion', label: '자유' },
  { key: 'question', label: '질문' },
  { key: 'share', label: '정보' },
  { key: 'congrats', label: '경조사' },
] as const;

type BoardCategory = (typeof BOARD_CATEGORIES)[number]['key'];

const PAGE_SIZE = 10;

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
    queryFn: () =>
      listPosts({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        category: category === 'all' ? undefined : category,
      }),
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
    <section className="mx-auto w-full max-w-3xl space-y-6 px-6 py-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">커뮤니티 게시판</h1>
          <p className="text-sm text-slate-600">회원 간 소통을 위한 게시판 스켈레톤입니다.</p>
        </div>
        <Link
          href="/board/new"
          className="inline-flex items-center justify-center rounded bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
        >
          새 글 작성
        </Link>
      </header>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <span>검색</span>
          <input
            className="w-48 rounded border border-slate-300 px-2 py-1"
            value={search}
            onChange={(e) => {
              setSearch(e.currentTarget.value);
              setPage(0);
            }}
            placeholder="제목 또는 내용"
          />
        </label>
      </div>

      <Tabs
        aria-label="게시판 카테고리"
        className="mt-2"
        defaultIndex={selectedIndex}
        onChange={(i) => {
          const key = BOARD_CATEGORIES[i]?.key ?? 'all';
          setCategory(key);
        }}
        items={BOARD_CATEGORIES.map((t) => ({
          id: t.key,
          label: t.label,
          content: (
            <div className="space-y-4">
              {query.isLoading ? (
                <p className="text-sm text-slate-600">게시글을 불러오는 중입니다…</p>
              ) : null}
              {query.isError ? (
                <p className="text-sm text-red-600">게시글을 불러오지 못했습니다.</p>
              ) : null}
              {!query.isLoading && filtered.length === 0 ? (
                <p className="rounded border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
                  아직 등록된 게시글이 없습니다.
                </p>
              ) : null}
              {filtered.length > 0 ? (
                <div className="overflow-x-auto border border-slate-300">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b-2 border-slate-400 bg-slate-100">
                        <th className="w-16 border-r border-slate-300 px-3 py-2.5 text-center text-xs font-semibold text-slate-700">번호</th>
                        <th className="w-20 border-r border-slate-300 px-3 py-2.5 text-center text-xs font-semibold text-slate-700">분류</th>
                        <th className="border-r border-slate-300 px-3 py-2.5 text-left text-xs font-semibold text-slate-700">제목</th>
                        <th className="hidden w-24 border-r border-slate-300 px-3 py-2.5 text-center text-xs font-semibold text-slate-700 md:table-cell">작성자</th>
                        <th className="hidden w-24 px-3 py-2.5 text-center text-xs font-semibold text-slate-700 sm:table-cell">날짜</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((post, idx) => (
                        <tr
                          key={post.id}
                          className={`border-b border-slate-200 transition-colors ${
                            post.pinned
                              ? 'bg-yellow-50 hover:bg-yellow-100'
                              : 'bg-white hover:bg-slate-50'
                          }`}
                        >
                          <td className="border-r border-slate-200 px-3 py-2 text-center text-xs text-slate-600">
                            {post.pinned ? (
                              <span className="font-semibold text-amber-700">공지</span>
                            ) : (
                              <span>{page * PAGE_SIZE + idx + 1}</span>
                            )}
                          </td>
                          <td className="border-r border-slate-200 px-3 py-2 text-center">
                            {post.category ? (
                              <span className="inline-block rounded bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                                {post.category}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="border-r border-slate-200 px-3 py-2">
                            <Link
                              href={`/board/${post.id}`}
                              className="inline-flex items-center gap-1.5 text-[13px] text-slate-800 hover:text-blue-600 hover:underline"
                            >
                              {post.pinned && <span className="text-red-500">📌</span>}
                              <span>{post.title}</span>
                            </Link>
                          </td>
                          <td className="hidden border-r border-slate-200 px-3 py-2 text-center text-xs text-slate-600 md:table-cell">
                            {post.author_name || (post.author_id ? `회원${post.author_id}` : '-')}
                          </td>
                          <td className="hidden px-3 py-2 text-center text-[11px] text-slate-500 sm:table-cell">
                            {post.published_at ? new Date(post.published_at).toLocaleDateString('ko-KR', {
                              month: '2-digit',
                              day: '2-digit'
                            }).replace(/\. /g, '/').replace(/\.$/, '') : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ),
        }))}
      />

      <div className="flex items-center justify-between">
        <button
          type="button"
          className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 disabled:opacity-40"
          onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
          disabled={page === 0 || query.isLoading}
        >
          이전
        </button>
        <span className="text-sm text-slate-500">페이지 {page + 1}</span>
        <button
          type="button"
          className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 disabled:opacity-40"
          onClick={() => setPage((prev) => prev + 1)}
          disabled={(query.data ?? []).length < PAGE_SIZE || query.isLoading}
        >
          다음
        </button>
      </div>
    </section>
  );
}

export default function BoardPage() {
  return (
    <Suspense fallback={<section className="mx-auto w-full max-w-3xl px-6 py-6 text-sm text-slate-600">게시판을 불러오는 중…</section>}>
      <BoardPageInner />
    </Suspense>
  );
}
