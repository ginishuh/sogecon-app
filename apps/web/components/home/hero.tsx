"use client";

import Image from 'next/image';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { listPosts, type Post } from '../../services/posts';
import { useAuth } from '../../hooks/useAuth';

function pickHero(posts: Post[], opts: { allowUnpublished: boolean }): { post: Post | null; unpublished: boolean } {
  const now = Date.now();
  const isPublished = (p: Post) => !!p.published_at && Date.parse(p.published_at) <= now;
  const published = posts.filter(isPublished);
  if (published.length > 0) {
    // 서버가 pinned desc, published_at desc로 주지만 방어적으로 정렬 유지
    const sorted = [...published].sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || (Date.parse(b.published_at || '0') - Date.parse(a.published_at || '0')));
    return { post: sorted[0], unpublished: false };
  }
  if (opts.allowUnpublished && posts.length > 0) {
    const sorted = [...posts].sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || (Date.parse(b.published_at || '0') - Date.parse(a.published_at || '0')));
    return { post: sorted[0], unpublished: true };
  }
  return { post: null, unpublished: false };
}

export function HomeHeroMinimal() {
  const auth = useAuth();
  const isAdmin = auth.status === 'authorized' && auth.data?.kind === 'admin';

  const query = useQuery<Post[]>({
    queryKey: ['posts', 'hero', 5, 0],
    queryFn: () => listPosts({ category: 'hero', limit: 5 }),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const { post, unpublished } = pickHero(query.data ?? [], { allowUnpublished: Boolean(isAdmin) });
  const image = post?.cover_image ?? '/images/home/hero-launch.svg';
  const caption = post?.title ?? '공지 · 행사 · 동문 수첩을 한 곳에서';

  return (
    <section className="home-hero home-hero--image-only" aria-label="서비스 소개">
      <figure className="home-hero__figure">
        <Image
          src={image}
          alt={caption}
          width={1200}
          height={720}
          className="home-hero__media"
          sizes="100vw"
          priority
        />
        <figcaption className="home-hero__caption">
          {caption}
          {unpublished && isAdmin ? (
            <span className="ml-2 rounded bg-amber-400/90 px-1.5 py-0.5 text-[11px] font-semibold text-black align-middle">관리자 미리보기</span>
          ) : null}
        </figcaption>
      </figure>
    </section>
  );
}

export default HomeHeroMinimal;

