"use client";

import Link from 'next/link';

import type { Post } from '../services/posts';
import { getAuthorName, getPostCategoryLabel } from '../lib/community';
import { ImageGallery } from './image-gallery';
import { PostAdminActions } from './post-admin-actions';

type PostDetailContentProps = {
  post: Post;
  backHref?: '/posts' | '/admin/posts';
  backLabel?: string;
};

type PostHeaderProps = {
  category?: string | null;
  pinned?: boolean;
  title: string;
  authorName?: string | null;
  publishedAt?: string | null;
  viewCount?: number;
};

function PostHeader({
  category,
  pinned,
  title,
  authorName,
  publishedAt,
  viewCount,
}: PostHeaderProps) {
  const categoryLabel = getPostCategoryLabel(category);
  return (
    <header className="space-y-2">
      <div className="flex items-center gap-2">
        {categoryLabel && (
          <span className="rounded bg-surface-raised px-2 py-0.5 text-xs font-medium text-text-secondary">
            {categoryLabel}
          </span>
        )}
        {pinned && (
          <span className="text-state-warning" title="상단 고정">
            📌
          </span>
        )}
      </div>
      <h1 className="text-2xl font-semibold text-text-primary">{title}</h1>
      <div className="flex items-center gap-3 text-sm text-text-muted">
        <span>{getAuthorName(authorName)}</span>
        {publishedAt && (
          <time dateTime={publishedAt}>
            {new Date(publishedAt).toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </time>
        )}
        {viewCount != null && viewCount > 0 && <span className="text-xs">조회 {viewCount}</span>}
      </div>
    </header>
  );
}

export function PostDetailContent({
  post,
  backHref = '/posts',
  backLabel = '← 목록으로 돌아가기',
}: PostDetailContentProps) {
  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <Link href={backHref} className="text-sm text-text-secondary hover:underline">
          {backLabel}
        </Link>
        <PostAdminActions postId={post.id} postTitle={post.title} />
      </div>

      <PostHeader
        category={post.category}
        pinned={post.pinned}
        title={post.title}
        authorName={post.author_name}
        publishedAt={post.published_at}
        viewCount={post.view_count}
      />

      <ImageGallery coverImage={post.cover_image} images={post.images} />

      <div className="whitespace-pre-wrap text-base leading-relaxed text-text-primary">
        {post.content}
      </div>
    </article>
  );
}
