import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ApiError } from '../../../lib/api';
import { getPost } from '../../../services/posts';

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
      <article className="mx-auto w-full max-w-3xl space-y-4 px-6 py-6">
        <Link href="/board" className="text-sm text-slate-600 underline">
          ← 목록으로 돌아가기
        </Link>
        <header className="space-y-3">
          {post.category ? (
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{post.category}</span>
          ) : null}
          <h1 className="text-2xl font-semibold">{post.title}</h1>
          <p className="text-xs text-slate-500">
            {post.published_at ? new Date(post.published_at).toLocaleString() : '게시 예정'}
          </p>
        </header>
        <div className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{post.content}</div>
      </article>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }
}
