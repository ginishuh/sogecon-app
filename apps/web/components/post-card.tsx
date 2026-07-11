import Link from 'next/link';
import type { Route } from 'next';
import React from 'react';
import Image from 'next/image';
import { Card } from './ui/card';

export interface PostCardProps {
  title: string;
  content: string;
  category?: string | null;
  pinned?: boolean;
  cover_image?: string | null;
  published_at?: string | null;
  href?: Route; // 상세로 이동할 링크(선택)
}

/** 게시판 카드 — 카테고리 배지, 날짜, 제목, 요약 */
export function PostCard({ title, content, category, pinned, cover_image, published_at, href }: PostCardProps) {
  const headingNode = href ? (
    <Link href={href} className="hover:underline">
      {title}
    </Link>
  ) : (
    <span>{title}</span>
  );

  return (
    <Card
      elevation="xs"
      className="transition hover:shadow-sm"
      heading={headingNode}
      meta={
        <div className="flex items-center gap-2 text-xs text-neutral-muted">
          {category ? (
            <span aria-label="category" className="inline-flex min-w-9 items-center justify-center rounded bg-brand-surface px-2 py-0.5 text-caption font-medium text-brand-700">
              {category}
            </span>
          ) : null}
          {pinned ? (
            <span aria-label="pinned" title="상단 고정" className="inline-flex items-center text-state-warning">📌</span>
          ) : null}
          {published_at ? (
            <time dateTime={published_at}>{new Date(published_at).toLocaleDateString()}</time>
          ) : null}
        </div>
      }
    >
      {cover_image ? (
        <Image
          src={cover_image}
          alt="cover"
          width={640}
          height={160}
          className="mb-2 h-40 w-full rounded object-cover"
        />
      ) : null}
      <p className="line-clamp-2 text-sm text-text-secondary">{content}</p>
    </Card>
  );
}

export default PostCard;
