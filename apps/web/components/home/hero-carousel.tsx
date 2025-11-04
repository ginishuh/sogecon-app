"use client";

import Image from 'next/image';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listPosts, type Post } from '../../services/posts';
import { useAuth } from '../../hooks/useAuth';

type Slide = { id: string; image: string; title: string; description: string; unpublished?: boolean };

// 단어 경계를 고려한 텍스트 자르기 (최대 maxLength 이내에서 마지막 완전한 단어까지)
function truncateAtWordBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  // 공백이 없으면 그냥 자르기 (단일 긴 단어)
  if (lastSpace === -1) return truncated;

  return truncated.substring(0, lastSpace);
}

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
    title: p.title || '공지 · 행사 · 동문 수첩을 한 곳에서',
    description: p.content ? truncateAtWordBoundary(p.content, 100) : '우수 교수의 지속적 학술과 연구방향의 강화, 충실한 교육',
    unpublished: !isPublished(p)
  }));

  if (slides.length > 0) return slides;
  // 폴백 3장(Figma 디자인 기반)
  return [
    {
      id: 'fallback-1',
      image: '/images/home/hero-launch.svg',
      title: '함께 성장하는 동문 네트워크',
      description: '전문성과 경험을 나누는 따뜻한 커뮤니티'
    },
    {
      id: 'fallback-2',
      image: '/images/home/hero.svg',
      title: '미래를 창조하는 서강경제',
      description: '우수 교수의 지속적 학술과 연구방향의 강화, 충실한 교육'
    },
    {
      id: 'fallback-3',
      image: '/images/home/hero-launch.svg',
      title: '2025년 정기 총회 안내',
      description: '동문 여러분을 초대합니다'
    }
  ].slice(0, opts.max);
}

export default function HomeHeroCarousel() {
  const auth = useAuth();
  const isAdmin = auth.status === 'authorized' && auth.data?.kind === 'admin';
  const q = useQuery<Post[]>({ queryKey: ['posts', 'hero', 8, 0], queryFn: () => listPosts({ category: 'hero', limit: 8 }) });
  const slides = useMemo(() => buildSlides(q.data ?? [], { allowUnpublished: !!isAdmin, max: 5 }), [q.data, isAdmin]);
  const isLoading = q.isLoading;

  const [index, setIndex] = useState(0);
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
    const t = e.touches.item(0);
    if (!t) return;
    touchStartX.current = t.clientX;
    touchDeltaX.current = 0;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const t = e.touches.item(0);
    if (!t) return;
    touchDeltaX.current = t.clientX - touchStartX.current;
  };
  const onTouchEnd = () => {
    const dx = touchDeltaX.current;
    touchStartX.current = null; touchDeltaX.current = 0;
    const threshold = 48; // px
    if (dx <= -threshold) next();
    else if (dx >= threshold) prev();
  };

  return (
    <section
      className="relative h-[218px] md:h-[400px] lg:h-[591px] overflow-hidden rounded-2xl shadow-xl"
      aria-label="홈 배너"
      role="region"
      aria-roledescription="carousel"
      aria-live="off"
    >
      {/* 로딩 인디케이터 */}
      {isLoading && (
        <div className="absolute inset-0 bg-neutral-surface flex items-center justify-center z-20">
          <div className="flex items-center gap-2 text-neutral-muted">
            <svg className="animate-spin h-5 w-5 text-brand-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>로딩 중...</span>
          </div>
        </div>
      )}

      <div
        className="relative h-full"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocus={() => setIsPaused(true)}
        onBlur={() => setIsPaused(false)}
      >
        {/* 슬라이드 트랙 */}
        <div
          className="flex h-full transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((s, i) => (
            <div
              key={s.id}
              className="relative min-w-full h-full"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${slides.length}`}
            >
              {/* 배경 이미지 */}
              <div className="absolute inset-0">
                <Image
                  src={s.image}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="100vw"
                  priority={i === 0}
                />
              </div>

              {/* 그라디언트 오버레이 */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

              {/* 텍스트 컨텐츠 — 반응형 정렬: 모바일(중앙), 데스크톱(하단 좌측) */}
              <div className="absolute inset-0 flex items-center justify-center px-14 md:px-6 md:items-end md:justify-start md:pb-6 md:pt-16 lg:pt-24">
                <div className="text-center md:text-left max-w-full">
                  <h2 className="text-[28px] md:text-[30px] lg:text-[32px] font-medium leading-tight tracking-tight text-white mb-2">
                    {s.title}
                    {s.unpublished && isAdmin ? (
                      <span className="ml-2 rounded bg-amber-400/90 px-1.5 py-0.5 text-[11px] font-semibold text-black align-middle">
                        관리자 미리보기
                      </span>
                    ) : null}
                  </h2>
                  <p className="text-[15px] leading-6 text-white/90 line-clamp-2">{s.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 좌우 화살표 버튼 */}
        {slides.length > 1 ? (
          <>
            <button
              aria-label="이전 배너"
              className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10 rounded-full bg-white/30 backdrop-blur-sm hover:bg-white/40 transition-colors"
              onClick={prev}
            >
              <svg aria-hidden="true" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M15 6l-6 6 6 6"/>
              </svg>
            </button>
            <button
              aria-label="다음 배너"
              className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10 rounded-full bg-white/30 backdrop-blur-sm hover:bg-white/40 transition-colors"
              onClick={next}
            >
              <svg aria-hidden="true" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M9 6l6 6-6 6"/>
              </svg>
            </button>
          </>
        ) : null}
      </div>

      {/* 인디케이터 */}
      {slides.length > 1 ? (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10" aria-label="배너 선택">
          {slides.map((_, i) => (
            <button
              key={`dot-${i}`}
              aria-label={`${i + 1}번째 배너 보기`}
              aria-current={i === index ? 'true' : undefined}
              className={`h-2 rounded-full transition-all ${
                i === index ? 'bg-white w-6' : 'bg-white/50 w-2'
              }`}
              onClick={() => go(i)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
