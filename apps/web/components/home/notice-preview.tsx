"use client";

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { listPosts, type Post } from '../../services/posts';

type NoticeItem = { id: number; title: string; published_at?: string };

const FALLBACK: NoticeItem[] = [
  { id: 1, title: '[공지] 서비스 오픈 안내', published_at: '2025-10-08' },
  { id: 2, title: '정기총회 일정 공지', published_at: '2025-10-25' },
  { id: 3, title: 'FAQ/정책 문서 업데이트', published_at: '2025-10-08' }
];

export default function NoticePreview() {
  const [items, setItems] = useState<NoticeItem[]>(FALLBACK);

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return; // 테스트에서는 네트워크 생략
    void (async () => {
      try {
        let posts: Post[] = [];
        try {
          posts = await listPosts({ limit: 5, offset: 0, category: 'notice' });
        } catch {
          posts = await listPosts({ limit: 5, offset: 0 });
        }
        setItems(posts.map((p) => ({ id: p.id, title: p.title, published_at: p.published_at ?? undefined })));
      } catch {
        // 폴백 유지
      }
    })();
  }, []);

  return (
    <section aria-labelledby="home-notices" className="rounded-3xl bg-white px-6 py-7 shadow-sm md:px-10">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="home-notices" className="font-heading text-2xl text-neutral-ink md:text-3xl">공지사항</h2>
        <Link className="home-hero__secondary" href="/posts">더보기</Link>
      </div>
      <ul role="list" aria-label="최신 공지 목록" className="divide-y divide-neutral-border">
        {items.map((it) => (
          <li key={it.id} className="flex items-center justify-between py-3">
            <Link href={{ pathname: '/posts' }} className="text-sm text-neutral-ink hover:underline">
              {it.title}
            </Link>
            {it.published_at ? (
              <time className="text-xs text-neutral-muted" dateTime={it.published_at}>{it.published_at}</time>
            ) : (
              <span className="text-xs text-neutral-muted">-</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
