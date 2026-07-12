import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ImageGallery } from '../../../components/image-gallery';
import { PostAdminActions } from '../../../components/post-admin-actions';
import { ApiError } from '../../../lib/api';
import { getPost } from '../../../services/posts';
import { getAuthorName, getPostCategoryLabel } from '../../../lib/community';

type PageProps = {
  params: Promise<{ id: string }>;
};

type PostHeaderProps = {
  category?: string | null;
  pinned?: boolean;
  title: string;
  authorName?: string | null;
  publishedAt?: string | null;
  viewCount?: number;
};

/** 게시글 헤더 컴포넌트 */
function PostHeader({ category, pinned, title, authorName, publishedAt, viewCount }: PostHeaderProps) {
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

export default async function PostDetailPage({ params }: PageProps) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (Number.isNaN(id)) notFound();

  try {
    const post = await getPost(id);
    return (
      <article className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <div className="flex items-center justify-between">
          <Link href="/posts" className="text-sm text-text-secondary hover:underline">
            ← 목록으로 돌아가기
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

        {/* 이미지 갤러리 */}
        <ImageGallery coverImage={post.cover_image} images={post.images} />

        {/* 본문 */}
        <div className="whitespace-pre-wrap text-base leading-relaxed text-text-primary">
          {post.content}
        </div>
      </article>
    );
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      notFound();
    }
    throw e;
  }
}
