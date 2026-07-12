"use client";

import { ArrowRight, CalendarBlank, MapPin } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import React, { useMemo } from 'react';

import { resolveApiAssetUrl } from '../../lib/api';
import { listEvents, type Event } from '../../services/events';
import { listPosts, type Post } from '../../services/posts';

const NOTICE_LIMIT = 4;
const NEWS_LIMIT = 3;
const EVENT_FETCH_LIMIT = 20;
const NEWS_FALLBACK_IMAGE = '/images/home/alumni-networking-hero.webp';

function formatDate(dateValue: string | null | undefined): string {
  if (!dateValue) return '-';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Seoul',
  })
    .formatToParts(date)
    .filter((part) => part.type !== 'literal')
    .map((part) => part.value)
    .join('.');
}

function postImage(post: Post): string {
  if (post.cover_image) return resolveApiAssetUrl(post.cover_image);
  const first = post.images?.[0];
  return typeof first === 'string' && first.trim() ? resolveApiAssetUrl(first) : NEWS_FALLBACK_IMAGE;
}

function parseDateMs(value: string): number | null {
  const milliseconds = new Date(value).getTime();
  return Number.isNaN(milliseconds) ? null : milliseconds;
}

function nextEvent(events: Event[]): Event | null {
  const now = Date.now();
  return (
    events
      .filter((event) => (parseDateMs(event.ends_at) ?? 0) >= now)
      .sort((a, b) => (parseDateMs(a.starts_at) ?? 0) - (parseDateMs(b.starts_at) ?? 0))[0] ?? null
  );
}

function SectionHeading({ title, href }: { title: string; href: Route }) {
  return (
    <div className="flex min-h-11 items-center justify-between border-b border-neutral-border pb-3">
      <h3 className="text-base font-semibold text-text-primary md:text-lg">{title}</h3>
      <Link
        href={href}
        className="inline-flex min-h-11 items-center gap-1 px-2 text-sm font-medium text-text-secondary no-underline transition hover:text-brand-700 hover:no-underline focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        전체보기
        <ArrowRight aria-hidden="true" size={17} weight="bold" />
      </Link>
    </div>
  );
}

function EmptyState({ message, href, action }: { message: string; href: Route; action: string }) {
  return (
    <div className="flex min-h-48 flex-col items-start justify-center py-6">
      <p className="text-sm leading-6 text-text-secondary">{message}</p>
      <Link href={href} className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-700 no-underline hover:no-underline">
        {action}
        <ArrowRight aria-hidden="true" size={17} weight="bold" />
      </Link>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-3 py-5" aria-label="목록을 불러오는 중">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={`activity-loading-${index}`} className="h-11 animate-pulse rounded-lg bg-neutral-subtle" />
      ))}
    </div>
  );
}

function NoticeColumn({ query }: { query: ReturnType<typeof useNoticeQuery> }) {
  return (
    <section className="min-w-0 lg:pr-6">
      <SectionHeading title="공지사항" href="/posts?category=notice" />
      {query.isLoading ? (
        <LoadingRows />
      ) : query.isError ? (
        <EmptyState message="공지사항을 불러오지 못했어요." href="/posts?category=notice" action="공지사항 다시 보기" />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState message="새 공지가 등록되면 이곳에서 가장 먼저 알려드릴게요." href="/posts?category=notice" action="지난 소식 둘러보기" />
      ) : (
        <ol className="divide-y divide-neutral-border">
          {(query.data ?? []).map((post) => (
            <li key={post.id}>
              <Link
                href={`/posts/${post.id}`}
                className="grid min-h-14 grid-cols-[0.35rem_1fr_auto] items-center gap-3 py-3 no-underline hover:no-underline focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-600" />
                <span className="line-clamp-2 text-sm leading-5 text-text-primary">{post.title}</span>
                <time className="text-xs text-text-muted">{formatDate(post.published_at)}</time>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function EventColumn({ query, event }: { query: ReturnType<typeof useEventsQuery>; event: Event | null }) {
  return (
    <section className="min-w-0 border-t border-neutral-border pt-5 lg:border-l lg:border-t-0 lg:px-6 lg:pt-0">
      <SectionHeading title="행사안내" href="/events" />
      {query.isLoading ? (
        <LoadingRows />
      ) : query.isError ? (
        <EmptyState message="행사 일정을 불러오지 못했어요." href="/events" action="행사 일정 다시 보기" />
      ) : !event ? (
        <EmptyState message="새 행사를 준비하고 있어요. 다음 만남이 정해지면 알려드릴게요." href="/events" action="행사 안내 보기" />
      ) : (
        <Link
          href={`/events/${event.id}`}
          className="group mt-4 block overflow-hidden rounded-2xl bg-[#f8f3ed] no-underline hover:no-underline focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <div className="relative aspect-[2/1] overflow-hidden">
            <Image
              src={NEWS_FALLBACK_IMAGE}
              alt=""
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              sizes="(max-width: 1023px) 100vw, 33vw"
            />
          </div>
          <div className="p-5">
            <p className="text-xs font-semibold text-brand-700">다가오는 만남</p>
            <h4 className="mt-2 line-clamp-2 text-lg font-semibold leading-7 text-text-primary">{event.title}</h4>
            <div className="mt-4 space-y-2 text-sm text-text-secondary">
              <span className="flex items-center gap-2">
                <CalendarBlank aria-hidden="true" size={18} className="text-brand-700" />
                {formatDate(event.starts_at)}
              </span>
              {event.location?.trim() ? (
                <span className="flex items-center gap-2">
                  <MapPin aria-hidden="true" size={18} className="text-brand-700" />
                  {event.location.trim()}
                </span>
              ) : null}
            </div>
          </div>
        </Link>
      )}
    </section>
  );
}

function NewsColumn({ query }: { query: ReturnType<typeof useNewsQuery> }) {
  return (
    <section className="min-w-0 border-t border-neutral-border pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
      <SectionHeading title="소식" href="/posts?category=news" />
      {query.isLoading ? (
        <LoadingRows />
      ) : query.isError ? (
        <EmptyState message="동문회 소식을 불러오지 못했어요." href="/posts?category=news" action="소식 다시 보기" />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState message="동문의 이야기와 활동 소식을 준비하고 있어요." href="/posts?category=news" action="전체 소식 보기" />
      ) : (
        <ol className="divide-y divide-neutral-border">
          {(query.data ?? []).map((post) => (
            <li key={post.id}>
              <Link
                href={`/posts/${post.id}`}
                className="group grid min-h-20 grid-cols-[5rem_1fr] items-center gap-3 py-3 no-underline hover:no-underline focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <span className="relative block aspect-[4/3] overflow-hidden rounded-lg bg-neutral-subtle">
                  <Image src={postImage(post)} alt="" fill className="object-cover transition-transform duration-300 group-hover:scale-105" sizes="80px" />
                </span>
                <span className="min-w-0">
                  <span className="line-clamp-2 text-sm font-medium leading-5 text-text-primary">{post.title}</span>
                  <time className="mt-1 block text-xs text-text-muted">{formatDate(post.published_at)}</time>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function useNoticeQuery() {
  return useQuery<Post[]>({
    queryKey: ['posts', 'notice', NOTICE_LIMIT, 'home-refined'],
    queryFn: () => listPosts({ category: 'notice', limit: NOTICE_LIMIT }),
  });
}

function useNewsQuery() {
  return useQuery<Post[]>({
    queryKey: ['posts', 'news', NEWS_LIMIT, 'home-refined'],
    queryFn: () => listPosts({ category: 'news', limit: NEWS_LIMIT }),
  });
}

function useEventsQuery() {
  return useQuery<Event[]>({
    queryKey: ['events', EVENT_FETCH_LIMIT, 'home-refined'],
    queryFn: () => listEvents({ limit: EVENT_FETCH_LIMIT }),
    staleTime: 30_000,
  });
}

export function HomeDesktopCards() {
  const noticesQuery = useNoticeQuery();
  const newsQuery = useNewsQuery();
  const eventsQuery = useEventsQuery();
  const upcomingEvent = useMemo(() => nextEvent(eventsQuery.data ?? []), [eventsQuery.data]);

  return (
    <section aria-labelledby="home-activity" className="mt-12 md:mt-16">
      <div className="flex items-end justify-between border-b-2 border-brand-700 pb-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.08em] text-brand-700">지금 동문회에서는</p>
          <h2 id="home-activity" className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-text-primary">최근 활동</h2>
        </div>
      </div>
      <div className="grid gap-5 pt-6 lg:grid-cols-3 lg:gap-0">
        <NoticeColumn query={noticesQuery} />
        <EventColumn query={eventsQuery} event={upcomingEvent} />
        <NewsColumn query={newsQuery} />
      </div>
    </section>
  );
}

export default HomeDesktopCards;
