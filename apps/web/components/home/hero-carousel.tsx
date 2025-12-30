"use client";

import Image from 'next/image';
import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listHeroSlides, type HeroSlide } from '../../services/hero';
import { useAuth } from '../../hooks/useAuth';
import { HeroSkeleton } from '../ui/skeleton';

type Slide = { id: string; image: string; title: string; description: string; href: string; unpublished?: boolean };

// 단어 경계를 고려한 텍스트 자르기 (최대 maxLength 이내에서 마지막 완전한 단어까지)
function truncateAtWordBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  // 공백이 없으면 그냥 자르기 (단일 긴 단어)
  if (lastSpace === -1) return truncated;

  return truncated.substring(0, lastSpace);
}

function buildSlides(data: HeroSlide[], opts: { max: number }): Slide[] {
  const slides = data.slice(0, opts.max).map((s) => ({
    id: `hero-${s.id}`,
    image: s.image || '/images/home/hero-launch.svg',
    title: s.title || '공지 · 행사 · 동문 수첩을 한 곳에서',
    description: s.description ? truncateAtWordBoundary(s.description, 100) : '우수 교수의 지속적 학술과 연구방향의 강화, 충실한 교육',
    href: s.href,
    unpublished: !!s.unpublished,
  }));

  if (slides.length > 0) return slides;
  // 폴백 3장(Figma 디자인 기반)
  return [
    {
      id: 'fallback-1',
      image: '/images/home/hero-launch.svg',
      title: '함께 성장하는 동문 네트워크',
      description: '전문성과 경험을 나누는 따뜻한 커뮤니티',
      href: '/about/greeting'
    },
    {
      id: 'fallback-2',
      image: '/images/home/hero.svg',
      title: '미래를 창조하는 서강경제',
      description: '우수 교수의 지속적 학술과 연구방향의 강화, 충실한 교육',
      href: '/posts'
    },
    {
      id: 'fallback-3',
      image: '/images/home/hero-launch.svg',
      title: '2025년 정기 총회 안내',
      description: '동문 여러분을 초대합니다',
      href: '/events'
    }
  ].slice(0, opts.max);
}

export default function HomeHeroCarousel() {
  const auth = useAuth();
  const isAdmin = auth.status === 'authorized' && auth.data?.kind === 'admin';
  const q = useQuery<HeroSlide[]>({
    queryKey: ['hero', 'slides', 8, isAdmin],
    queryFn: () => listHeroSlides({ limit: 8, include_unpublished: !!isAdmin }),
    retry: false,
  });
  const slides = useMemo(() => buildSlides(q.data ?? [], { max: 5 }), [q.data]);
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

  // 초기 렌더링 시 Skeleton 표시, 데이터가 있으면 실제 콘텐츠 표시
  if (isLoading || slides.length === 0) {
    return <HeroSkeleton />;
  }

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
      className="relative h-[218px] md:h-[320px] lg:h-[420px] overflow-hidden rounded-2xl shadow-xl"
      aria-label="홈 배너"
      role="region"
      aria-roledescription="carousel"
      aria-live="off"
    >
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
                  sizes="(max-width: 768px) calc(100vw - 2rem), (max-width: 1152px) calc(100vw - 4rem), 68rem"
                  priority={i === 0 || i === 1} // 첫 2개 이미지 우선 로드
                  placeholder="blur"
                  quality={90}
                  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
                />
              </div>

              {/* 그라디언트 오버레이 */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

              {/* 텍스트 컨텐츠 — 반응형 정렬: 모바일(중앙), 데스크톱(하단 좌측) */}
              <div className="absolute inset-0 flex items-end justify-start px-6 pb-6">
                <div className="text-left max-w-full">
                  <h2 className="text-[28px] md:text-[30px] lg:text-[32px] font-medium leading-tight tracking-tight text-white mb-2">
                    {s.title}
                    {s.unpublished && isAdmin ? (
                      <span className="ml-2 rounded bg-state-warning px-1.5 py-0.5 text-caption font-semibold text-black align-middle">
                        관리자 미리보기
                      </span>
                    ) : null}
                  </h2>
                  <p className="text-body leading-6 text-white/90 line-clamp-2">{s.description}</p>
                  <div className="mt-3">
                    <Link
                      href={{ pathname: s.href }}
                      className="inline-flex items-center gap-1 rounded-full bg-brand-primary px-3 py-1.5 text-sm text-white shadow-sm transition-colors hover:bg-brand-primaryDark hover:text-white hover:no-underline focus:outline-none focus-visible:text-white focus-visible:no-underline focus-visible:ring-2 focus-visible:ring-white/70 active:bg-brand-primaryDark active:text-white"
                      aria-label={`${s.title} 자세히 보기`}
                    >
                      자세히 보기
                      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M7 5l6 5-6 5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                  </div>
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
