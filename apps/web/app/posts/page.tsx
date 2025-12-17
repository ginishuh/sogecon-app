'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '../../hooks/useAuth';
import { splitPinned } from '../../lib/posts';
import { listPosts, type Post } from '../../services/posts';
import { PostCard } from '../../components/post-card';
import { ButtonLink } from '../../components/ui/button-link';

type Category = 'all' | 'notice' | 'news';

function parseCategory(value: string | null): Category {
  if (value === 'notice') return 'notice';
  if (value === 'news') return 'news';
  if (value === 'all') return 'all';
  return 'all';
}

function PinnedList({ posts, limit, onViewAll }: { posts: Post[]; limit: number; onViewAll: () => void }) {
  const toShow = posts.slice(0, limit);
  if (toShow.length === 0) return null;
  const hasMore = posts.length > limit;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-state-warning">고정된 공지</h3>
      <ul className="space-y-3">
        {toShow.map((post) => (
          <li key={`pinned-${post.id}`}>
            <Link href={`/posts/${post.id}`} className="block">
              <PostCard
                title={post.title}
                content={post.content}
                category={post.category}
                pinned={post.pinned}
                cover_image={post.cover_image}
                published_at={post.published_at}
              />
            </Link>
          </li>
        ))}
      </ul>
      {hasMore ? (
        <button
          type="button"
          className="text-xs text-state-warning underline"
          onClick={onViewAll}
        >공지 전체 보기</button>
      ) : null}
    </div>
  );
}

function PostsList({ posts, category, setCategory }: { posts: Post[]; category: Category; setCategory: (c: Category) => void }) {
  const { pinned, regular } = useMemo(() => splitPinned(posts), [posts]);
  const pinnedLimit = 3;
  const showPinnedSection = (category === 'all' || category === 'notice') && pinned.length > 0;
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <button onClick={() => setCategory('all')} className={`rounded px-2 py-1 ${category==='all'?'bg-brand-700 text-text-inverse':'border border-neutral-border text-text-primary'}`}>전체</button>
        <button onClick={() => setCategory('notice')} className={`rounded px-2 py-1 ${category==='notice'?'bg-brand-700 text-text-inverse':'border border-neutral-border text-text-primary'}`}>공지</button>
        <button onClick={() => setCategory('news')} className={`rounded px-2 py-1 ${category==='news'?'bg-brand-700 text-text-inverse':'border border-neutral-border text-text-primary'}`}>소식</button>
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
            <Link href={`/posts/${post.id}`} className="block">
              <PostCard
                title={post.title}
                content={post.content}
                category={post.category}
                pinned={post.pinned}
                cover_image={post.cover_image}
                published_at={post.published_at}
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function WriteButton() {
  const { data: auth } = useAuth();
  if (auth?.kind !== 'admin') return null;
  return (
    <ButtonLink href="/admin/posts/new" className="gap-1 shadow-sm">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      글쓰기
    </ButtonLink>
  );
}

export default function PostsPage() {
  const searchParams = useSearchParams();
  const urlCategory = parseCategory(searchParams.get('category'));
  const [category, setCategory] = useState<Category>(urlCategory);

  useEffect(() => {
    setCategory(urlCategory);
  }, [urlCategory]);

  const query = useQuery<Post[]>({
    queryKey: ['posts', 20, 0, category],
    queryFn: () => {
      if (category === 'all') {
        return listPosts({ limit: 20, categories: ['notice', 'news'] });
      }
      return listPosts({ limit: 20, category });
    },
  });

  if (query.isLoading) {
    return <p>게시글을 불러오는 중입니다…</p>;
  }

  if (query.isError) {
    return <p className="text-state-error">게시글을 불러오지 못했습니다.</p>;
  }

  const posts = query.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">공지/소식</h1>
        <WriteButton />
      </div>
      {posts.length === 0 ? (
        <p>게시글이 아직 없습니다.</p>
      ) : (
        <PostsList posts={posts} category={category} setCategory={setCategory} />
      )}
    </div>
  );
}
