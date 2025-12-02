"use client";

import Link from 'next/link';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { listPosts, type Post } from '../../services/posts';
import { NoticeSkeleton } from '../ui/skeleton';

// 날짜 포맷팅 함수 (Intl.DateTimeFormat 사용으로 TZ/포맷 안전성 확보)
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '-';

  const formatter = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Seoul'
  });

  // formatToParts()로 "2025.11.04" 형식 생성 (regex 대신 명시적 파싱)
  const parts = formatter.formatToParts(date);
  return parts
    .filter((p) => p.type !== 'literal')
    .map((p) => p.value)
    .join('.');
}

export function HomeNoticeList() {
  const { data: posts, isLoading, isError } = useQuery<Post[]>({
    queryKey: ['posts', 'notice', 5, 0],
    queryFn: () => listPosts({ category: 'notice', limit: 5 })
  });

  const notices = posts?.slice(0, 5) ?? [];

  return (
    <section aria-labelledby="home-notices" className="mt-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h2 id="home-notices" className="font-kopub text-base text-neutral-ink">
          공지사항
        </h2>
        <Link
          href="/posts"
          className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-primary hover:bg-brand-primaryDark transition-colors"
          aria-label="공지사항 전체 보기"
        >
          <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 10h10M10 5l5 5-5 5" />
          </svg>
        </Link>
      </div>

      {/* 공지사항 목록 */}
      <div className="border-t border-neutral-border">
        {isLoading ? (
          <ul className="divide-y divide-neutral-border">
            {Array.from({ length: 5 }, (_, i) => (
              <li key={`skeleton-${i}`}>
                <NoticeSkeleton />
              </li>
            ))}
          </ul>
        ) : isError ? (
          <div className="py-8 text-center text-state-error">
            공지사항을 불러오는데 실패했습니다.
          </div>
        ) : notices.length === 0 ? (
          <div className="py-8 text-center text-neutral-muted">
            등록된 공지사항이 없습니다.
          </div>
        ) : (
          <ul className="divide-y divide-neutral-border">
            {notices.map((notice) => (
              <li key={notice.id}>
                <Link
                  href={`/posts/${notice.id}`}
                  className="flex items-center justify-between py-4 hover:bg-neutral-surface/50 transition-colors gap-4"
                >
                  <p className="text-[15px] text-neutral-ink line-clamp-2 flex-1">
                    {notice.title}
                  </p>
                  <time className="text-base text-neutral-muted shrink-0 self-start">
                    {notice.published_at ? formatDate(notice.published_at) : '-'}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default HomeNoticeList;
