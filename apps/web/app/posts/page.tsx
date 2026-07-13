'use client';

import { Plus } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '../../hooks/useAuth';
import { splitPinned } from '../../lib/posts';
import { hasPermissionSession } from '../../lib/rbac';
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
            <Link href={`/posts/${post.id}`} className="block rounded-xl focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">
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
          className="min-h-11 rounded-lg px-3 text-sm font-medium text-state-warning underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
          onClick={onViewAll}
        >공지 전체 보기</button>
      ) : null}
    </div>
  );
}

function getEmptyTitle(category: Category): string {
  if (category === 'notice') return '현재 확인할 공지사항이 없습니다.';
  if (category === 'news') return '아직 전해진 동문 소식이 없습니다.';
  return '아직 등록된 공지와 동문 소식이 없습니다.';
}

function PostsList({ posts, category, setCategory }: { posts: Post[]; category: Category; setCategory: (c: Category) => void }) {
  const { pinned, regular } = useMemo(() => splitPinned(posts), [posts]);
  const pinnedLimit = 3;
  const showPinnedSection = (category === 'all' || category === 'notice') && pinned.length > 0;
  const hasContent = pinned.length > 0 || regular.length > 0;
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="공지와 동문 소식 분류">
        <button type="button" aria-pressed={category === 'all'} onClick={() => setCategory('all')} className={`min-h-11 rounded-full px-4 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 ${category==='all'?'bg-brand-700 text-text-inverse':'border border-neutral-border text-text-primary'}`}>전체</button>
        <button type="button" aria-pressed={category === 'notice'} onClick={() => setCategory('notice')} className={`min-h-11 rounded-full px-4 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 ${category==='notice'?'bg-brand-700 text-text-inverse':'border border-neutral-border text-text-primary'}`}>공지사항</button>
        <button type="button" aria-pressed={category === 'news'} onClick={() => setCategory('news')} className={`min-h-11 rounded-full px-4 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 ${category==='news'?'bg-brand-700 text-text-inverse':'border border-neutral-border text-text-primary'}`}>동문 소식</button>
      </div>
      {showPinnedSection ? (
        <PinnedList
          posts={pinned}
          limit={pinnedLimit}
          onViewAll={() => setCategory('notice')}
        />
      ) : null}
      {hasContent ? (
        <ul className="space-y-3">
          {regular.map((post) => (
            <li key={post.id}>
              <Link href={`/posts/${post.id}`} className="block rounded-xl focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">
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
      ) : (
        <div className="rounded-2xl bg-surface-raised px-5 py-10 text-center">
          <p className="font-medium text-text-primary">{getEmptyTitle(category)}</p>
          <p className="mt-2 text-sm text-text-muted">새 소식이 등록되면 이곳에서 가장 먼저 확인할 수 있습니다.</p>
        </div>
      )}
    </section>
  );
}

function WriteButton() {
  const { data: auth } = useAuth();
  if (!hasPermissionSession(auth, 'admin_posts')) return null;
  return (
    <ButtonLink href="/admin/posts/new" className="gap-1 shadow-sm">
      <Plus size={17} weight="bold" aria-hidden="true" />
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
    return <p className="py-10 text-center text-sm text-text-secondary">공지와 동문 소식을 불러오는 중입니다…</p>;
  }

  if (query.isError) {
    return <div role="alert" className="space-y-3 rounded-xl bg-state-error-subtle px-5 py-8 text-center text-state-error"><p>공지와 동문 소식을 불러오지 못했습니다.</p><button type="button" className="min-h-11 rounded-lg border border-state-error px-4 font-medium" onClick={() => void query.refetch()}>다시 불러오기</button></div>;
  }

  const posts = query.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1"><p className="text-sm font-medium text-brand-700">동문회 소식</p><h1 className="text-2xl font-semibold">공지사항과 반가운 소식</h1><p className="text-sm text-text-secondary">중요한 안내와 동문의 활동 소식을 확인하세요.</p></div>
        <WriteButton />
      </div>
      <PostsList posts={posts} category={category} setCategory={setCategory} />
    </div>
  );
}
