"use client";

import {
  ArrowCounterClockwise,
  ArrowDown,
  ChatCircle,
  ImageSquare,
  MagnifyingGlass,
  PencilSimple,
  PushPin,
} from '@phosphor-icons/react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import React, { Suspense, useEffect, useMemo, useState } from 'react';

import { Tabs } from '../../components/ui/tabs';
import { resolveApiAssetUrl } from '../../lib/api';
import { BOARD_CATEGORY_KEYS, getAuthorName, getBoardCategoryInfo, type BoardCategoryKey } from '../../lib/community';
import { formatBoardDate } from '../../lib/date-utils';
import { listPosts, type Post } from '../../services/posts';

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

function postImage(post: Post): string | null {
  if (post.cover_image?.trim()) return resolveApiAssetUrl(post.cover_image);
  const first = post.images?.find((image) => typeof image === 'string' && image.trim());
  return first ? resolveApiAssetUrl(first) : null;
}

function postExcerpt(post: Post): string {
  const plain = post.content.replace(/\s+/g, ' ').trim();
  return plain.length > 130 ? `${plain.slice(0, 130).trim()}…` : plain;
}

function FeaturedStory({ post }: { post: Post }) {
  const image = postImage(post);
  if (!image) return null;

  return (
    <Link
      href={`/board/${post.id}`}
      className="group grid overflow-hidden rounded-2xl border border-brand-100 bg-[#fcf9f6] no-underline shadow-xs transition hover:border-brand-200 hover:no-underline hover:shadow-sm focus-visible:ring-2 focus-visible:ring-brand-500 md:grid-cols-[19rem_1fr]"
      aria-label={`주요 이야기: ${post.title}`}
    >
      <span className="relative block min-h-48 overflow-hidden md:min-h-52">
        <Image
          src={image}
          alt=""
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          sizes="(max-width: 767px) 100vw, 304px"
        />
      </span>
      <span className="flex min-w-0 flex-col justify-center p-6 md:p-8">
        <span className="flex items-center gap-2 text-xs font-semibold text-brand-700">
          <PushPin aria-hidden="true" size={17} weight="fill" />
          주요 이야기
        </span>
        <strong className="mt-3 line-clamp-2 text-xl font-semibold leading-8 tracking-[-0.025em] text-text-primary md:text-2xl">
          {post.title}
        </strong>
        <span className="mt-3 line-clamp-2 text-sm leading-6 text-text-secondary">{postExcerpt(post)}</span>
        <span className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
          <span className="font-medium text-text-secondary">{getAuthorName(post.author_name)}</span>
          <time>{formatBoardDate(post.published_at)}</time>
          <span className="inline-flex items-center gap-1">
            <ChatCircle aria-hidden="true" size={16} />
            {post.comment_count ?? 0}
          </span>
        </span>
      </span>
    </Link>
  );
}

function BoardPostList({ posts }: { posts: Post[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-border bg-white">
      <div className="hidden min-h-12 grid-cols-[7rem_minmax(0,1fr)_10rem_6.5rem_4rem] items-center gap-3 bg-[#faf7f3] px-5 text-xs font-medium text-text-muted sm:grid">
        <span>구분</span>
        <span>제목</span>
        <span>작성자</span>
        <span>작성일</span>
        <span className="text-center">댓글</span>
      </div>
      <ul className="divide-y divide-neutral-border">
        {posts.map((post) => {
          const category = getBoardCategoryInfo(post.category);
          const hasImage = !!postImage(post);
          return (
            <li key={post.id} className={post.pinned ? 'bg-brand-50/45' : undefined}>
              <Link
                href={`/board/${post.id}`}
                className="group grid min-w-0 gap-2 px-5 py-4 no-underline transition hover:bg-surface-raised/80 hover:no-underline focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 sm:min-h-[4.5rem] sm:grid-cols-[7rem_minmax(0,1fr)_10rem_6.5rem_4rem] sm:items-center sm:gap-3 sm:py-3"
              >
                <span className="flex items-center gap-2 text-xs font-semibold text-brand-700">
                  {post.pinned ? <PushPin aria-hidden="true" size={15} weight="fill" /> : null}
                  {category?.shortLabel ?? '동문 이야기'}
                </span>
                <span className="min-w-0">
                  <span className="flex min-w-0 items-center gap-2">
                    <strong className="line-clamp-2 break-words text-sm font-medium leading-6 text-text-primary sm:line-clamp-1 sm:text-[0.95rem]">
                      {post.title}
                    </strong>
                    {hasImage ? <ImageSquare aria-label="이미지 포함" size={17} className="shrink-0 text-text-muted" /> : null}
                  </span>
                </span>
                <span className="text-xs font-medium text-text-secondary sm:text-sm">{getAuthorName(post.author_name)}</span>
                <time className="text-xs text-text-muted">{formatBoardDate(post.published_at)}</time>
                <span className="inline-flex items-center gap-1 text-xs text-text-muted sm:justify-center">
                  <ChatCircle aria-hidden="true" size={16} />
                  {post.comment_count ?? 0}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
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

function emptyCopy(search: string, info: BoardPanelProps['info']) {
  if (search.trim()) return { title: '검색 결과가 없습니다.', description: '검색어를 바꾸거나 초기화해 다시 확인해 보세요.' };
  if (info) return { title: info.emptyTitle, description: info.emptyDescription };
  return { title: '아직 등록된 게시글이 없습니다.', description: '먼저 동문들과 이야기를 나눠 보세요.' };
}

function BoardResults(props: Pick<BoardPanelProps, 'posts' | 'sourceCount' | 'isLoading' | 'isError' | 'search' | 'info' | 'onRetry' | 'onNextPage'>) {
  if (props.isLoading) {
    return (
      <div className="space-y-2" aria-label="게시글을 불러오는 중">
        {Array.from({ length: 4 }, (_, index) => <div key={`board-loading-${index}`} className="h-[4.5rem] animate-pulse rounded-lg bg-neutral-subtle" />)}
      </div>
    );
  }
  if (props.isError) {
    return (
      <div role="alert" className="space-y-3 rounded-2xl bg-state-error-subtle px-5 py-10 text-center text-sm text-state-error">
        <p>게시글을 불러오지 못했습니다.</p>
        <button type="button" className="min-h-11 rounded-lg border border-state-error px-4 font-medium" onClick={props.onRetry}>다시 불러오기</button>
      </div>
    );
  }
  if (props.posts.length === 0) {
    const copy = emptyCopy(props.search, props.info);
    return (
      <div className="space-y-3 rounded-2xl bg-surface-raised px-5 py-12 text-center">
        <p className="font-medium text-text-primary">{copy.title}</p>
        <p className="text-sm text-text-muted">{copy.description}</p>
        {props.search.trim() ? null : (
          <Link href="/board/new" className="inline-flex min-h-11 items-center rounded-lg bg-brand-primary px-5 font-semibold text-white no-underline hover:no-underline focus-visible:ring-2 focus-visible:ring-brand-500">
            첫 글 남기기
          </Link>
        )}
      </div>
    );
  }
  return (
    <>
      <BoardPostList posts={props.posts} />
      <div className="flex justify-center pt-5">
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-neutral-border bg-white px-6 text-sm text-text-secondary transition hover:bg-surface-raised disabled:opacity-40"
          onClick={props.onNextPage}
          disabled={props.sourceCount < PAGE_SIZE}
        >
          더 불러오기
          <ArrowDown aria-hidden="true" size={17} />
        </button>
      </div>
    </>
  );
}

function BoardPanel(props: BoardPanelProps) {
  return (
    <div className="space-y-5">
      {props.info ? <p className="text-sm leading-6 text-text-secondary">{props.info.description}</p> : null}
      <div className="flex min-w-0 gap-2 max-[360px]:flex-col">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">게시글 검색</span>
          <MagnifyingGlass aria-hidden="true" size={21} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            className="min-h-12 w-full min-w-0 rounded-xl border border-neutral-border bg-white py-3 pl-12 pr-4 text-sm focus:border-brand-400 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
            value={props.search}
            onChange={(event) => props.onSearchChange(event.currentTarget.value)}
            placeholder="제목이나 내용으로 찾아보세요"
          />
        </label>
        <button
          type="button"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-neutral-border bg-white px-5 text-sm text-text-secondary transition hover:bg-surface-raised"
          onClick={props.onSearchReset}
        >
          <ArrowCounterClockwise aria-hidden="true" size={18} />
          초기화
        </button>
      </div>
      <BoardResults {...props} />
    </div>
  );
}

function BoardPageInner() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') ?? 'all').toLowerCase();
  const categoryKeys = BOARD_CATEGORIES.map((category) => category.key);
  const initialCategory: BoardCategory = categoryKeys.includes(initialTab as BoardCategory)
    ? (initialTab as BoardCategory)
    : initialTab === 'free'
      ? 'discussion'
      : 'all';
  const [category, setCategory] = useState<BoardCategory>(initialCategory);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');

  useEffect(() => setPage(0), [category]);

  const query = useQuery<Post[]>({
    queryKey: ['board', category, page],
    queryFn: () => {
      const baseParams = { limit: PAGE_SIZE, offset: page * PAGE_SIZE };
      return category === 'all'
        ? listPosts({ ...baseParams, categories: [...BOARD_POST_CATEGORIES] })
        : listPosts({ ...baseParams, category });
    },
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

  const featured = useMemo(
    () => page === 0 && !search.trim() ? filtered.find((post) => post.pinned && postImage(post)) ?? null : null,
    [filtered, page, search]
  );
  // 주요 이야기는 목록에서 제거하지 않는다. 한 건뿐인 저콘텐츠 상태에서도
  // 강조 카드와 "게시글 없음"이 동시에 노출되지 않고, 목록의 완전성도 유지된다.
  const listPostsData = filtered;
  const selectedIndex = Math.max(0, BOARD_CATEGORIES.findIndex((item) => item.key === category));
  const selectedInfo = category === 'all' ? null : getBoardCategoryInfo(category as BoardCategoryKey);

  const panel = (
    <BoardPanel
      info={selectedInfo}
      search={search}
      posts={listPostsData}
      sourceCount={(query.data ?? []).length}
      isLoading={query.isLoading}
      isError={query.isError}
      onSearchChange={(value) => {
        setSearch(value);
        setPage(0);
      }}
      onSearchReset={() => setSearch('')}
      onRetry={() => void query.refetch()}
      onNextPage={() => setPage((previous) => previous + 1)}
    />
  );

  return (
    <section className="brand-wide-page w-full space-y-6 py-3 pb-16 md:space-y-7 md:py-6">
      <header className="flex flex-col gap-5 border-b border-neutral-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand-700">동문 커뮤니티</p>
          <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-text-primary md:text-[2.5rem]">서로의 안부와 경험을 나눠요</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary md:text-base">자유로운 이야기부터 질문, 행사 후기와 경조사까지 목적에 맞는 공간을 선택해 주세요.</p>
        </div>
        <Link
          href="/board/new"
          className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-primary px-6 font-semibold text-white no-underline shadow-sm transition hover:bg-brand-primaryDark hover:text-white hover:no-underline focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          aria-label="새 게시글 쓰기"
        >
          <PencilSimple aria-hidden="true" size={21} weight="bold" />
          글쓰기
        </Link>
      </header>

      {featured ? <FeaturedStory post={featured} /> : null}

      <div className="rounded-2xl border border-neutral-border bg-white px-4 pb-5 shadow-xs sm:px-6 sm:pb-6">
        <Tabs
          aria-label="게시 유형"
          variant="editorial"
          defaultIndex={selectedIndex}
          onChange={(index) => setCategory(BOARD_CATEGORIES[index]?.key ?? 'all')}
          items={BOARD_CATEGORIES.map((item) => ({ id: item.key, label: item.label, content: panel }))}
        />
      </div>
    </section>
  );
}

export default function BoardPage() {
  return (
    <Suspense fallback={<section className="brand-wide-page py-8 text-sm text-text-secondary">게시판을 불러오는 중…</section>}>
      <BoardPageInner />
    </Suspense>
  );
}
