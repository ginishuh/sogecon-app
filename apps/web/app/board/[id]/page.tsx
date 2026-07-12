import Link from 'next/link';
import { notFound } from 'next/navigation';
import dynamic from 'next/dynamic';

import { ApiError } from '../../../lib/api';
import { getPost } from '../../../services/posts';
import { formatFullDate } from '../../../lib/date-utils';
import { ImageGallery } from '../../../components/image-gallery';
import { getAuthorName, getBoardCategoryInfo } from '../../../lib/community';

const CommentsSection = dynamic(
  () => import('../../../components/comments-section').then((mod) => ({ default: mod.CommentsSection }))
);

const BoardPostActions = dynamic(
  () => import('../../../components/board-post-actions').then((mod) => ({ default: mod.BoardPostActions }))
);

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function BoardDetailPage({ params }: PageProps) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (Number.isNaN(id)) {
    notFound();
  }

  try {
    const post = await getPost(id);
    return (
      <div className="mx-auto w-full max-w-4xl px-6 py-6">
        <Link href="/board" className="inline-block mb-4 text-sm text-text-secondary hover:text-text-primary">
          ← 목록으로
        </Link>

        {/* 게시글 카드 */}
        <article className="border border-neutral-border bg-white">
          {/* 헤더 */}
          <header className="border-b-2 border-neutral-border bg-surface-raised px-6 py-4">
            <div className="flex items-center gap-2 mb-3">
              {getBoardCategoryInfo(post.category) ? (
                <span className="inline-block rounded bg-neutral-subtle px-2 py-1 text-xs font-medium text-text-secondary">
                  {getBoardCategoryInfo(post.category)?.label}
                </span>
              ) : null}
              {post.pinned ? (
                <span className="text-state-error">📌</span>
              ) : null}
            </div>
            <h1 className="text-xl font-bold text-text-primary mb-3">{post.title}</h1>
            <div className="flex items-center gap-4 text-xs text-text-secondary">
              <span>{getAuthorName(post.author_name)}</span>
              <span>•</span>
              <span>
                {formatFullDate(post.published_at)}
              </span>
            </div>
          </header>

          {/* 본문 */}
          <div className="px-6 py-8 space-y-6">
            {/* 이미지 갤러리 */}
            <ImageGallery coverImage={post.cover_image} images={post.images} />

            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-sm leading-7 text-text-primary">
                {post.content}
              </div>
            </div>
          </div>

          {/* 하단 버튼 영역 */}
          <div className="border-t border-neutral-border bg-surface-raised px-6 py-3 flex justify-between">
            <Link
              href="/board"
              className="inline-flex min-h-11 items-center rounded border border-neutral-border bg-white px-4 text-sm text-text-secondary hover:bg-surface-raised focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              목록
            </Link>
            <BoardPostActions postId={id} postTitle={post.title} authorId={post.author_id} />
          </div>
        </article>

        {/* 댓글 영역 */}
        <CommentsSection postId={id} />
      </div>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }
}
