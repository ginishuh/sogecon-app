import Link from 'next/link';
import { notFound } from 'next/navigation';
import dynamic from 'next/dynamic';

import { ApiError } from '../../../lib/api';
import { getPost } from '../../../services/posts';
import { formatFullDate } from '../../../lib/date-utils';

const CommentsSection = dynamic(
  () => import('../../../components/comments-section').then((mod) => ({ default: mod.CommentsSection }))
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
        <Link href="/board" className="inline-block mb-4 text-sm text-slate-600 hover:text-slate-900">
          ← 목록으로
        </Link>

        {/* 게시글 카드 */}
        <article className="border border-slate-300 bg-white">
          {/* 헤더 */}
          <header className="border-b-2 border-slate-300 bg-slate-50 px-6 py-4">
            <div className="flex items-center gap-2 mb-3">
              {post.category ? (
                <span className="inline-block rounded bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700">
                  {post.category}
                </span>
              ) : null}
              {post.pinned ? (
                <span className="text-red-500">📌</span>
              ) : null}
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-3">{post.title}</h1>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span>작성자: {post.author_name || `회원${post.author_id}`}</span>
              <span>•</span>
              <span>
                {formatFullDate(post.published_at)}
              </span>
            </div>
          </header>

          {/* 본문 */}
          <div className="px-6 py-8">
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-[14px] leading-7 text-slate-800">
                {post.content}
              </div>
            </div>
          </div>

          {/* 하단 버튼 영역 */}
          <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 flex justify-end gap-2">
            <Link
              href="/board"
              className="rounded border border-slate-300 bg-white px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              목록
            </Link>
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
