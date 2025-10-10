import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApiError } from '../../../lib/api';
import { getPost } from '../../../services/posts';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PostDetailPage({ params }: PageProps) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (Number.isNaN(id)) notFound();

  try {
    const post = await getPost(id);
    return (
      <article className="space-y-4 p-6">
        <Link href="/posts" className="text-sm text-slate-600 underline">
          ← 목록으로 돌아가기
        </Link>
        <header className="space-y-2">
          {post.category ? (
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{post.category}</span>
          ) : null}
          <h1 className="text-2xl font-semibold">{post.title}</h1>
          <p className="text-xs text-slate-500">
            {post.published_at ? new Date(post.published_at).toLocaleString() : '게시 예정'}
          </p>
        </header>
        {post.cover_image ? (
          <Image
            src={post.cover_image}
            alt="cover"
            width={720}
            height={405}
            sizes="(max-width: 768px) 100vw, 720px"
            className="h-auto w-full rounded object-cover"
          />
        ) : null}
        <div className="whitespace-pre-wrap text-sm text-slate-800">{post.content}</div>
      </article>
    );
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      notFound();
    }
    throw e;
  }
}
