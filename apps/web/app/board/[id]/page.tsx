import { ArrowLeft, PushPin } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import dynamic from 'next/dynamic';

import { ApiError } from '../../../lib/api';
import { getPost } from '../../../services/posts';
import { formatPostFullDate, resolvePostDate } from '../../../lib/date-utils';
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
    const category = getBoardCategoryInfo(post.category);
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 md:py-6">
        <Link
          href="/board"
          className="mb-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-brand-700 no-underline transition hover:bg-brand-50 hover:no-underline focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <ArrowLeft aria-hidden="true" size={18} weight="bold" />
          게시판으로
        </Link>

        <article>
          <header className="border-b border-neutral-border pb-6 md:pb-7">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {category ? (
                <span className="inline-flex min-h-8 items-center rounded-lg border border-brand-200 bg-brand-50 px-3 text-xs font-semibold text-brand-700">
                  {category.label}
                </span>
              ) : null}
              {post.pinned ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700">
                  <PushPin aria-hidden="true" size={16} weight="fill" />
                  주요 이야기
                </span>
              ) : null}
            </div>

            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <h1 className="break-words text-[1.75rem] font-semibold leading-[1.3] tracking-[-0.035em] text-text-primary md:text-[2rem]">
                  {post.title}
                </h1>
                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
                  <span className="font-semibold text-text-secondary">{getAuthorName(post.author_name)}</span>
                  <span aria-hidden="true">·</span>
                  <time dateTime={resolvePostDate(post.published_at, post.created_at) ?? undefined}>
                    {formatPostFullDate(post.published_at, post.created_at)}
                  </time>
                </div>
              </div>
              <div className="shrink-0">
                <BoardPostActions postId={id} postTitle={post.title} authorId={post.author_id} />
              </div>
            </div>
          </header>

          <div className="space-y-7 py-7 md:space-y-9 md:py-9">
            <div className="max-w-2xl">
              <ImageGallery coverImage={post.cover_image} images={post.images} />
            </div>

            <div className="max-w-2xl whitespace-pre-wrap break-words text-[0.98rem] leading-8 text-text-primary">
              {post.content}
            </div>
          </div>

        </article>

        <CommentsSection postId={id} />

        <div className="mt-8 border-t border-neutral-border pt-5">
          <Link
            href="/board"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-brand-700 no-underline transition hover:bg-brand-50 hover:no-underline focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <ArrowLeft aria-hidden="true" size={18} weight="bold" />
            게시판으로 돌아가기
          </Link>
        </div>
      </div>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }
}
