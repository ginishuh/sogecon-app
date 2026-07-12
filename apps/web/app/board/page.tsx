"use client";

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import Link from 'next/link';
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';

import { listPosts, type Post } from '../../services/posts';
import { Tabs } from '../../components/ui/tabs';
import { formatBoardDate } from '../../lib/date-utils';
import { BOARD_CATEGORY_KEYS, getAuthorName, getBoardCategoryInfo, type BoardCategoryKey } from '../../lib/community';
import { resolveApiAssetUrl } from '../../lib/api';

const BOARD_CATEGORIES = [
  { key: 'all', label: '전체' },
  { key: 'discussion', label: '자유게시판' },
  { key: 'question', label: '묻고 답하기' },
  { key: 'share', label: '이야기·후기' },
  { key: 'congrats', label: '경조사' },
] as const;

type BoardCategory = (typeof BOARD_CATEGORIES)[number]['key'];

const PAGE_SIZE = 10;
const BOARD_POST_CATEGORIES = BOARD_CATEGORY_KEYS;

function BoardPostList({ posts }: { posts: Post[] }) {
  return (
    <ul className="space-y-2">
      {posts.map((post) => (
        <li key={post.id}>
          <Link href={`/board/${post.id}`} className="flex min-w-0 items-start gap-3 rounded-lg border border-neutral-border bg-white p-4 transition-colors hover:bg-surface-raised focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 max-[240px]:flex-col">
            {post.category === 'share' && post.cover_image ? <Image src={resolveApiAssetUrl(post.cover_image)} alt="" width={96} height={72} className="h-18 w-24 shrink-0 rounded-lg object-cover max-[240px]:h-auto max-[240px]:w-full" /> : null}
            {getBoardCategoryInfo(post.category) ? <span className="mt-0.5 inline-block rounded bg-brand-600 px-2 py-0.5 text-xs font-medium text-white">{getBoardCategoryInfo(post.category)?.shortLabel}</span> : null}
            <div className="min-w-0 flex-1 space-y-1">
              <h3 className="break-words text-body font-medium text-text-primary">{post.pinned ? <span className="mr-1">📌</span> : null}{post.title}</h3>
              <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                <span className="font-medium text-text-secondary">{getAuthorName(post.author_name)}</span>
                <span>·</span>
                <span>{formatBoardDate(post.published_at)}</span>
                <span>·</span>
                <span>댓글 {post.comment_count ?? 0}</span>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

type BoardPanelProps = {
  info: ReturnType<typeof getBoardCategoryInfo> | null;
  search: string;
  posts: Post[];
  sourceCount: number;
  isLoading: boolean;
  isError: boolean;
  onSearchChange: (value: string) => void;
  onSearchReset: () => void;
  onRetry: () => void;
  onNextPage: () => void;
};

function getEmptyCopy(search: string, info: BoardPanelProps['info']) {
  if (search.trim()) return { title: '검색 결과가 없습니다.', description: '검색어를 바꾸거나 초기화해 다시 확인해 보세요.' };
  if (info) return { title: info.emptyTitle, description: info.emptyDescription };
  return { title: '아직 등록된 게시글이 없습니다.', description: '먼저 동문들과 이야기를 나눠 보세요.' };
}

function BoardResults(props: Pick<BoardPanelProps, 'posts' | 'sourceCount' | 'isLoading' | 'isError' | 'search' | 'info' | 'onRetry' | 'onNextPage'>) {
  if (props.isLoading) return <p className="py-8 text-center text-sm text-text-muted">게시글을 불러오는 중입니다…</p>;
  if (props.isError) return <div role="alert" className="space-y-2 rounded-xl bg-state-error-subtle px-5 py-6 text-center text-sm text-state-error"><p>게시글을 불러오지 못했습니다.</p><button type="button" className="min-h-11 rounded-lg border border-state-error px-4 font-medium" onClick={props.onRetry}>다시 불러오기</button></div>;
  if (props.posts.length === 0) {
    const copy = getEmptyCopy(props.search, props.info);
    return <div className="space-y-3 rounded-2xl bg-surface-raised px-5 py-10 text-center"><p className="font-medium text-text-primary">{copy.title}</p><p className="text-sm text-text-muted">{copy.description}</p>{props.search.trim() ? null : <Link href="/board/new" className="inline-flex min-h-11 items-center rounded-lg bg-brand-primary px-5 font-semibold text-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">첫 글 남기기</Link>}</div>;
  }
  return <><BoardPostList posts={props.posts} /><div className="flex justify-center pt-4"><button type="button" className="min-h-11 rounded-full border border-neutral-border bg-white px-6 text-sm text-text-secondary hover:bg-surface-raised disabled:opacity-40" onClick={props.onNextPage} disabled={props.sourceCount < PAGE_SIZE}>더 불러오기</button></div></>;
}

function BoardPanel(props: BoardPanelProps) {
  return (
    <div className="space-y-3 pt-3">
      {props.info ? <p className="text-sm text-text-secondary">{props.info.description}</p> : null}
      <div className="flex min-w-0 items-center gap-2 max-[240px]:flex-col max-[240px]:items-stretch">
        <input className="min-h-11 min-w-0 flex-1 rounded-full border border-neutral-border bg-surface-raised px-4 text-sm focus:border-brand-400 focus:bg-white focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500" value={props.search} onChange={(event) => props.onSearchChange(event.currentTarget.value)} placeholder="제목이나 내용으로 찾아보세요" aria-label="게시글 검색" />
        <button type="button" className="min-h-11 rounded-full border border-neutral-border bg-white px-4 text-sm text-text-secondary hover:bg-surface-raised" onClick={props.onSearchReset}>초기화</button>
      </div>
      <BoardResults {...props} />
    </div>
  );
}

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
  const selectedInfo = category === 'all' ? null : getBoardCategoryInfo(category as BoardCategoryKey);

  return (
    <section className="relative mx-auto w-full max-w-3xl space-y-4 px-4 py-4 pb-24">
      <header className="space-y-2 border-b border-neutral-border pb-4">
        <p className="text-sm font-medium text-brand-700">동문 커뮤니티</p>
        <h1 className="text-2xl font-semibold text-text-primary">서로의 안부와 경험을 나눠요</h1>
        <p className="text-sm leading-6 text-text-secondary">자유로운 이야기부터 질문, 행사 후기와 경조사까지 목적에 맞는 공간을 선택해 주세요.</p>
      </header>

      <div className="flex items-center gap-2 border-b border-neutral-border">
        <Tabs
          aria-label="게시 유형"
          className="flex-1"
          defaultIndex={selectedIndex}
          onChange={(i) => {
            const key = BOARD_CATEGORIES[i]?.key ?? 'all';
            setCategory(key);
          }}
          items={BOARD_CATEGORIES.map((t) => ({
            id: t.key,
            label: t.label,
            content: <BoardPanel info={selectedInfo} search={search} posts={filtered} sourceCount={(query.data ?? []).length} isLoading={query.isLoading} isError={query.isError} onSearchChange={(value) => { setSearch(value); setPage(0); }} onSearchReset={() => setSearch('')} onRetry={() => void query.refetch()} onNextPage={() => setPage((previous) => previous + 1)} />,
          }))}
        />
      </div>

      <Link
        href="/board/new"
        className="fixed bottom-6 right-6 z-50 flex min-h-14 items-center gap-2 rounded-full bg-brand-primary px-5 font-semibold text-white shadow-lg transition-colors hover:bg-brand-primaryDark focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 active:bg-brand-primaryDark"
        aria-label="새 게시글 쓰기"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span>글쓰기</span>
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
