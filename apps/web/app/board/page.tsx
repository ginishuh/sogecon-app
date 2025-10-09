'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';

import { listPosts, type Post } from '../../services/posts';

const BOARD_CATEGORIES = [
  { key: 'all', label: '전체' },
  { key: 'discussion', label: '자유' },
  { key: 'question', label: '질문' },
  { key: 'share', label: '정보' },
] as const;

type BoardCategory = (typeof BOARD_CATEGORIES)[number]['key'];

const PAGE_SIZE = 10;

export default function BoardPage() {
  const [category, setCategory] = useState<BoardCategory>('all');
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
        <nav className="flex gap-2">
          {BOARD_CATEGORIES.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setCategory(item.key)}
              className={`rounded px-3 py-1 text-sm ${category === item.key ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-700 hover:bg-slate-100'}`}
            >
              {item.label}
            </button>
          ))}
        </nav>
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

      <ul className="space-y-4">
        {filtered.map((post) => (
          <li key={post.id} className="rounded border border-slate-200 bg-white p-4 shadow-sm">
            <Link href={`/board/${post.id}`} className="block space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                {post.category ? (
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">{post.category}</span>
                ) : null}
                {post.published_at ? <span>{new Date(post.published_at).toLocaleDateString()}</span> : null}
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{post.title}</h3>
              <p className="line-clamp-2 text-sm text-slate-600">{post.content}</p>
            </Link>
          </li>
        ))}
      </ul>

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
