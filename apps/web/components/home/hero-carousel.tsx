"use client";

import Image from 'next/image';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listPosts, type Post } from '../../services/posts';
import { useAuth } from '../../hooks/useAuth';

type Slide = { id: string; image: string; caption: string; unpublished?: boolean };

function buildSlides(posts: Post[], opts: { allowUnpublished: boolean; max: number }): Slide[] {
  const now = Date.now();
  const isPublished = (p: Post) => !!p.published_at && Date.parse(p.published_at) <= now;
  const published = posts.filter(isPublished);
  const unpublished = opts.allowUnpublished ? posts.filter((p) => !isPublished(p)) : [];

  const ordered = [...published, ...unpublished].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || Date.parse(b.published_at || '0') - Date.parse(a.published_at || '0')
  );

  const slides = ordered.slice(0, opts.max).map((p) => ({
    id: `post-${p.id}`,
    image: p.cover_image || '/images/home/hero-launch.svg',
    caption: p.title || '공지 · 행사 · 동문 수첩을 한 곳에서',
    unpublished: !isPublished(p)
  }));

  if (slides.length > 0) return slides;
  // 폴백 1–2장(에셋 기반)
  return [
    { id: 'fallback-1', image: '/images/home/hero-launch.svg', caption: '공지 · 행사 · 동문 수첩을 한 곳에서' },
    { id: 'fallback-2', image: '/images/home/hero.svg', caption: '총동문회 웹 런치' }
  ].slice(0, opts.max);
}

export default function HomeHeroCarousel() {
  const auth = useAuth();
  const isAdmin = auth.status === 'authorized' && auth.data?.kind === 'admin';
  const q = useQuery<Post[]>({ queryKey: ['posts', 'hero', 8, 0], queryFn: () => listPosts({ category: 'hero', limit: 8 }) });
  const slides = useMemo(() => buildSlides(q.data ?? [], { allowUnpublished: !!isAdmin, max: 5 }), [q.data, isAdmin]);

  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef<number>(0);
  const [isPaused, setIsPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const go = useCallback((to: number) => {
    const n = slides.length;
    if (n === 0) return;
    setIndex(((to % n) + n) % n);
  }, [slides.length]);
  const next = useCallback(() => go(index + 1), [go, index]);
  const prev = useCallback(() => go(index - 1), [go, index]);

  // 키보드 좌우 화살표
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  // prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReducedMotion(m.matches);
    apply();
    m.addEventListener('change', apply);
    return () => m.removeEventListener('change', apply);
  }, []);

  // document hidden 시 일시정지
  useEffect(() => {
    const onVis = () => setIsPaused(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // autoplay
  useEffect(() => {
    if (reducedMotion || isPaused || slides.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((prev) => ((prev + 1) % slides.length));
    }, 5000);
    return () => window.clearInterval(id);
  }, [reducedMotion, isPaused, slides.length]);

  // slides 변경 시 index 보정
  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [slides.length, index]);

  // 터치 스와이프
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };
  const onTouchEnd = () => {
    const dx = touchDeltaX.current;
    touchStartX.current = null; touchDeltaX.current = 0;
    const threshold = 48; // px
    if (dx <= -threshold) next();
    else if (dx >= threshold) prev();
  };

  return (
    <section className="home-hero home-hero--image-only" aria-label="홈 배너" role="region" aria-roledescription="carousel" aria-live="off">
      <div
        className="hero-carousel"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocus={() => setIsPaused(true)}
        onBlur={() => setIsPaused(false)}
      >
        <div ref={trackRef} className="hero-track" style={{ transform: `translateX(-${index * 100}%)` }}>
          {slides.map((s, i) => (
            <div key={s.id} className="hero-slide" aria-roledescription="slide" aria-label={`${i + 1} / ${slides.length}`}>
              <figure className="home-hero__figure">
                <Image
                  src={s.image}
                  alt={s.caption}
                  width={1200}
                  height={720}
                  className="home-hero__media"
                  sizes="100vw"
                  priority={i === 0}
                />
                <figcaption className="home-hero__caption">
                  {s.caption}
                  {s.unpublished && isAdmin ? (
                    <span className="ml-2 rounded bg-amber-400/90 px-1.5 py-0.5 text-[11px] font-semibold text-black align-middle">관리자 미리보기</span>
                  ) : null}
                </figcaption>
              </figure>
            </div>
          ))}
        </div>

        {/* Arrows */}
        {slides.length > 1 ? (
          <>
            <button aria-label="이전 배너" className="hero-arrow hero-arrow--prev" onClick={prev}>
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 6l-6 6 6 6"/></svg>
            </button>
            <button aria-label="다음 배너" className="hero-arrow hero-arrow--next" onClick={next}>
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6"/></svg>
            </button>
          </>
        ) : null}
      </div>

      {/* Dots */}
      {slides.length > 1 ? (
        <div className="hero-dots" role="tablist" aria-label="배너 선택">
          {slides.map((_, i) => (
            <button
              key={`dot-${i}`}
              role="tab"
              aria-selected={i === index}
              aria-label={`${i + 1}번째 배너 보기`}
              className={`hero-dot ${i === index ? 'is-active' : ''}`}
              onClick={() => go(i)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
