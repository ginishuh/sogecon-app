'use client';

import { useQuery } from '@tanstack/react-query';
import { listPosts, type Post } from '../../services/posts';

export default function PostsPage() {
  const { data: posts, isLoading, isError } = useQuery<Post[]>({
    queryKey: ['posts', 20, 0],
    queryFn: () => listPosts({ limit: 20 })
  });

  if (isLoading) {
    return <p>게시글을 불러오는 중입니다…</p>;
  }

  if (isError) {
    return <p className="text-red-600">게시글을 불러오지 못했습니다.</p>;
  }

  if (!posts || posts.length === 0) {
    return <p>게시글이 아직 없습니다.</p>;
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">게시글</h2>
      <ul className="space-y-3">
        {posts.map((post) => (
          <li key={post.id} className="rounded border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="font-semibold">{post.title}</h3>
            <p className="mt-1 text-sm text-slate-700">{post.content}</p>
            <p className="mt-2 text-xs text-slate-500">
              게시일: {post.published_at ? new Date(post.published_at).toLocaleString() : '미정'}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
