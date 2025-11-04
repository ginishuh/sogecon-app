"use client";

import Link from 'next/link';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { listPosts, type Post } from '../../services/posts';

// 날짜 포맷팅 함수
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

export function HomeNoticeList() {
  const { data: posts } = useQuery<Post[]>({
    queryKey: ['posts', 'notice', 5, 0],
    queryFn: () => listPosts({ category: 'notice', limit: 5 })
  });

  const notices = posts?.slice(0, 5) ?? [];

  return (
    <section aria-labelledby="home-notices" className="mt-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h2 id="home-notices" className="text-base font-normal text-neutral-ink">
          공지사항
        </h2>
        <Link
          href="/posts"
          className="flex items-center justify-center w-8 h-8 rounded-full bg-[#8a1e2d] hover:bg-[#6c1722] transition-colors"
          aria-label="공지사항 전체 보기"
        >
          <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 10h10M10 5l5 5-5 5" />
          </svg>
        </Link>
      </div>

      {/* 공지사항 목록 */}
      <div className="border-t border-neutral-border">
        {notices.length === 0 ? (
          <div className="py-8 text-center text-neutral-muted">
            등록된 공지사항이 없습니다.
          </div>
        ) : (
          <ul className="divide-y divide-neutral-border">
            {notices.map((notice) => (
              <li key={notice.id}>
                <Link
                  href={`/posts/${notice.id}`}
                  className="flex items-center justify-between py-4 hover:bg-neutral-surface/50 transition-colors"
                >
                  <p className="text-[15px] text-neutral-ink truncate flex-1 mr-4">
                    {notice.title}
                  </p>
                  <time className="text-base text-neutral-muted shrink-0">
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
