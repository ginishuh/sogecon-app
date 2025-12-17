"use client";

import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { listEvents, type Event } from '../../services/events';
import { listPosts, type Post } from '../../services/posts';

const NOTICE_LIMIT = 3;
const NEWS_LIMIT = 4;
const EVENT_FETCH_LIMIT = 20;
const EVENT_LIMIT = 3;
const NEWS_FALLBACK_IMAGE = '/images/home/hero.svg';

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Seoul',
  })
    .formatToParts(date)
    .filter((p) => p.type !== 'literal')
    .map((p) => p.value)
    .join('.');
}

function pickPostImage(post: Post): string | null {
  const cover = post.cover_image ?? null;
  if (cover) return cover;
  const first = post.images?.[0] ?? null;
  return typeof first === 'string' && first.trim() ? first : null;
}

function requirePostImage(post: Post): string {
  return pickPostImage(post) ?? NEWS_FALLBACK_IMAGE;
}

function parseDateMs(value: string): number | null {
  const d = new Date(value);
  const ms = d.getTime();
  return Number.isNaN(ms) ? null : ms;
}

function buildUpcomingEvents(events: Event[], opts: { limit: number }): Event[] {
  const now = Date.now();
  const upcoming = events.filter((evt) => {
    const endsMs = parseDateMs(evt.ends_at);
    if (endsMs == null) return false;
    return endsMs >= now;
  });

  return upcoming
    .slice()
    .sort((a, b) => {
      const aMs = parseDateMs(a.starts_at) ?? 0;
      const bMs = parseDateMs(b.starts_at) ?? 0;
      return aMs - bMs;
    })
    .slice(0, opts.limit);
}

function SectionHeader({
  title,
  href,
  ariaLabel,
}: {
  title: string;
  href: Route;
  ariaLabel: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="font-kopub text-base text-neutral-ink">{title}</h2>
      <Link
        href={href}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary transition-colors hover:bg-brand-primaryDark"
        aria-label={ariaLabel}
      >
        <svg
          className="h-5 w-5 text-white"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M5 10h10M10 5l5 5-5 5" />
        </svg>
      </Link>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="py-10 text-center text-sm text-neutral-muted">{message}</div>;
}

function LoadingState() {
  return (
    <div className="space-y-2">
      <div className="h-4 w-3/4 rounded bg-neutral-subtle" />
      <div className="h-4 w-2/3 rounded bg-neutral-subtle" />
      <div className="h-4 w-1/2 rounded bg-neutral-subtle" />
    </div>
  );
}

function NoticeSection({
  isLoading,
  isError,
  posts,
}: {
  isLoading: boolean;
  isError: boolean;
  posts: Post[] | undefined;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-neutral-border p-5">
      <SectionHeader
        title="공지사항"
        href="/posts?category=notice"
        ariaLabel="공지사항 전체 보기"
      />
      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <EmptyState message="공지사항을 불러오지 못했습니다." />
      ) : (posts ?? []).length === 0 ? (
        <EmptyState message="등록된 공지사항이 없습니다." />
      ) : (
        <div className="space-y-1">
          {(posts ?? []).map((post) => (
            <NoticeItem key={post.id} post={post} />
          ))}
        </div>
      )}
    </section>
  );
}

function EventsSection({
  isLoading,
  isError,
  events,
}: {
  isLoading: boolean;
  isError: boolean;
  events: Event[];
}) {
  return (
    <section className="space-y-3 rounded-xl border border-neutral-border p-5">
      <SectionHeader title="행사안내" href="/events" ariaLabel="행사 전체 보기" />
      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <EmptyState message="행사를 불러오지 못했습니다." />
      ) : events.length === 0 ? (
        <EmptyState message="예정된 행사가 없습니다." />
      ) : (
        <div className="space-y-1">
          {events.map((evt) => (
            <Link
              key={evt.id}
              href={`/events/${evt.id}`}
              className="flex items-start justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface/70"
            >
              <span className="line-clamp-2 text-sm text-neutral-ink">{evt.title}</span>
              <span className="shrink-0 text-xs text-neutral-muted">{EventSubtitle(evt)}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function NewsSkeletonGrid() {
  return (
    <div className="grid grid-cols-3 gap-4 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={`news-skeleton-${i}`}
          className={`aspect-[4/3] rounded-2xl bg-neutral-subtle ${i === 3 ? 'hidden xl:block' : ''}`}
        />
      ))}
    </div>
  );
}

function NewsSection({
  isLoading,
  isError,
  posts,
}: {
  isLoading: boolean;
  isError: boolean;
  posts: Post[] | undefined;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-neutral-border p-5">
      <SectionHeader title="소식" href="/posts?category=news" ariaLabel="소식 전체 보기" />
      {isLoading ? (
        <NewsSkeletonGrid />
      ) : isError ? (
        <EmptyState message="소식을 불러오지 못했습니다." />
      ) : (posts ?? []).length === 0 ? (
        <EmptyState message="등록된 소식이 없습니다." />
      ) : (
        <div className="grid grid-cols-3 gap-4 xl:grid-cols-4">
          {(posts ?? []).map((post, idx) => (
            <Link
              key={post.id}
              href={`/posts/${post.id}`}
              className={`group relative overflow-hidden rounded-2xl border border-neutral-border bg-white shadow-sm transition-shadow hover:shadow-md ${
                idx === 3 ? 'hidden xl:block' : ''
              }`}
            >
              <div className="relative aspect-[4/3] bg-surface">
                <Image
                  src={requirePostImage(post)}
                  alt=""
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 1280px) 33vw, 25vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <div className="line-clamp-2 text-sm font-semibold text-white">{post.title}</div>
                  <div className="mt-1 text-xs text-white/80">{formatDate(post.published_at)}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function NoticeItem({ post }: { post: Post }) {
  return (
    <Link
      href={`/posts/${post.id}`}
      className="flex items-start justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface/70"
    >
      <span className="line-clamp-2 text-sm text-neutral-ink">{post.title}</span>
      <time className="shrink-0 text-xs text-neutral-muted">
        {formatDate(post.published_at)}
      </time>
    </Link>
  );
}

function EventSubtitle(evt: Event): string {
  const date = formatDate(evt.starts_at);
  const location = evt.location?.trim() ? evt.location.trim() : '';
  return location ? `${date} · ${location}` : date;
}

export function HomeDesktopCards() {
  const noticesQuery = useQuery<Post[]>({
    queryKey: ['posts', 'notice', NOTICE_LIMIT, 'home-desktop'],
    queryFn: () => listPosts({ category: 'notice', limit: NOTICE_LIMIT }),
  });

  const newsQuery = useQuery<Post[]>({
    queryKey: ['posts', 'news', NEWS_LIMIT, 'home-desktop'],
    queryFn: () => listPosts({ category: 'news', limit: NEWS_LIMIT }),
  });

  const eventsQuery = useQuery<Event[]>({
    queryKey: ['events', EVENT_FETCH_LIMIT, 'home-desktop'],
    queryFn: () => listEvents({ limit: EVENT_FETCH_LIMIT }),
    staleTime: 30_000,
  });

  const upcomingEvents = useMemo(
    () => buildUpcomingEvents(eventsQuery.data ?? [], { limit: EVENT_LIMIT }),
    [eventsQuery.data]
  );

  return (
    <section className="mt-8 space-y-10">
      <div className="grid grid-cols-2 gap-10">
        <NoticeSection
          isLoading={noticesQuery.isLoading}
          isError={noticesQuery.isError}
          posts={noticesQuery.data}
        />
        <EventsSection
          isLoading={eventsQuery.isLoading}
          isError={eventsQuery.isError}
          events={upcomingEvents}
        />
      </div>

      <NewsSection
        isLoading={newsQuery.isLoading}
        isError={newsQuery.isError}
        posts={newsQuery.data}
      />
    </section>
  );
}

export default HomeDesktopCards;
