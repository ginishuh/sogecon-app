'use client';

import { useQuery } from '@tanstack/react-query';
import { listPosts, type Post } from '../../services/posts';
import { PostCard } from '../../components/post-card';
import { useMemo, useState } from 'react';
import { splitPinned } from '../../lib/posts';

function PinnedList({ posts, limit, onViewAll }: { posts: Post[]; limit: number; onViewAll: () => void }) {
  const toShow = posts.slice(0, limit);
  if (toShow.length === 0) return null;
  const hasMore = posts.length > limit;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-amber-700">고정된 공지</h3>
      <ul className="space-y-3">
        {toShow.map((post) => (
          <li key={`pinned-${post.id}`}>
            <PostCard
              title={post.title}
              content={post.content}
              category={post.category}
              pinned={post.pinned}
              cover_image={post.cover_image}
              published_at={post.published_at}
            />
          </li>
        ))}
      </ul>
      {hasMore ? (
        <button
          type="button"
          className="text-xs text-amber-700 underline"
          onClick={onViewAll}
        >공지 전체 보기</button>
      ) : null}
    </div>
  );
}

function PostsList({ posts, category, setCategory }: { posts: Post[]; category: 'all'|'notice'|'news'; setCategory: (c: 'all'|'notice'|'news') => void }) {
  const { pinned, regular } = useMemo(() => splitPinned(posts), [posts]);
  const pinnedLimit = 3;
  const showPinnedSection = (category === 'all' || category === 'notice') && pinned.length > 0;
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">공지/소식</h2>
      <div className="flex items-center gap-2 text-sm">
        <button onClick={() => setCategory('all')} className={`rounded px-2 py-1 ${category==='all'?'bg-slate-900 text-white':'border'}`}>전체</button>
        <button onClick={() => setCategory('notice')} className={`rounded px-2 py-1 ${category==='notice'?'bg-slate-900 text-white':'border'}`}>공지</button>
        <button onClick={() => setCategory('news')} className={`rounded px-2 py-1 ${category==='news'?'bg-slate-900 text-white':'border'}`}>소식</button>
      </div>
      {showPinnedSection ? (
        <PinnedList
          posts={pinned}
          limit={pinnedLimit}
          onViewAll={() => setCategory('notice')}
        />
      ) : null}
      <ul className="space-y-3">
        {regular.map((post) => (
          <li key={post.id}>
            <PostCard
              title={post.title}
              content={post.content}
              category={post.category}
              pinned={post.pinned}
              cover_image={post.cover_image}
              published_at={post.published_at}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function PostsPage() {
  const [category, setCategory] = useState<'all'|'notice'|'news'>('all');
  const query = useQuery<Post[]>({
    queryKey: ['posts', 20, 0, category],
    queryFn: () => listPosts({ limit: 20, category: category === 'all' ? undefined : category }),
  });

  if (query.isLoading) {
    return <p>게시글을 불러오는 중입니다…</p>;
  }

  if (query.isError) {
    return <p className="text-red-600">게시글을 불러오지 못했습니다.</p>;
  }

  const posts = query.data ?? [];
  if (posts.length === 0) {
    return <p>게시글이 아직 없습니다.</p>;
  }

  return <PostsList posts={posts} category={category} setCategory={setCategory} />;
}
