"use client";

import { ArrowRight, CaretLeft, CaretRight } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '../../hooks/useAuth';
import { isAdminSession } from '../../lib/rbac';
import { listHeroSlides, type HeroSlide } from '../../services/hero';
import { HeroSkeleton } from '../ui/skeleton';

type Slide = {
  id: string;
  image: string;
  title: string;
  description: string;
  href: string;
  unpublished?: boolean;
};

const FALLBACK_HERO_IMAGE = '/images/home/alumni-networking-hero.webp';

function truncateAtWordBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace === -1 ? truncated : truncated.substring(0, lastSpace);
}

function buildSlides(data: HeroSlide[], opts: { max: number }): Slide[] {
  const slides = data.slice(0, opts.max).map((slide) => ({
    id: `hero-${slide.id}`,
    image: slide.image || FALLBACK_HERO_IMAGE,
    title: slide.title || '함께 성장하는 동문 네트워크',
    description: slide.description
      ? truncateAtWordBoundary(slide.description, 100)
      : '전문성과 경험을 나누는 따뜻한 커뮤니티',
    href: slide.href,
    unpublished: !!slide.unpublished,
  }));

  if (slides.length > 0) return slides;
  return [
    {
      id: 'fallback-1',
      image: FALLBACK_HERO_IMAGE,
      title: '함께 성장하는 동문 네트워크',
      description: '전문성과 경험을 나누는 따뜻한 커뮤니티',
      href: '/about/greeting',
    },
    {
      id: 'fallback-2',
      image: FALLBACK_HERO_IMAGE,
      title: '미래를 창조하는 서강경제',
      description: '배움과 경험을 이어 새로운 가능성을 만듭니다.',
      href: '/posts',
    },
    {
      id: 'fallback-3',
      image: FALLBACK_HERO_IMAGE,
      title: '동문과 함께하는 새로운 만남',
      description: '다가오는 행사와 동문회의 소식을 확인해 보세요.',
      href: '/events',
    },
  ].slice(0, opts.max);
}

function HeroTitle({ title }: { title: string }) {
  const words = title.trim().split(/\s+/);
  const splitAt = words.length >= 4 ? Math.ceil(words.length / 2) : words.length - 1;
  const first = words.slice(0, Math.max(splitAt, 1)).join(' ');
  const second = words.slice(Math.max(splitAt, 1)).join(' ');

  return (
    <h2 className="max-w-[12ch] text-[2rem] font-semibold leading-[1.16] tracking-[-0.04em] text-text-primary md:text-[2.75rem] lg:text-[3.25rem]">
      <span className="block">{first}</span>
      {second ? <span className="mt-1 block text-brand-700">{second}</span> : null}
    </h2>
  );
}

export default function HomeHeroCarousel() {
  const auth = useAuth();
  const isAdmin = auth.status === 'authorized' && isAdminSession(auth.data);
  const query = useQuery<HeroSlide[]>({
    queryKey: ['hero', 'slides', 8, isAdmin],
    queryFn: () => listHeroSlides({ limit: 8, include_unpublished: !!isAdmin }),
    retry: false,
  });
  const slides = useMemo(() => buildSlides(query.data ?? [], { max: 5 }), [query.data]);
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef(0);
  const [isPaused, setIsPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const go = useCallback(
    (to: number) => {
      if (slides.length === 0) return;
      setIndex(((to % slides.length) + slides.length) % slides.length);
    },
    [slides.length]
  );
  const next = useCallback(() => go(index + 1), [go, index]);
  const prev = useCallback(() => go(index - 1), [go, index]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReducedMotion(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    const onVisibility = () => setIsPaused(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (reducedMotion || isPaused || slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [reducedMotion, isPaused, slides.length]);

  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [index, slides.length]);

  if (query.isLoading || slides.length === 0) return <HeroSkeleton />;

  return (
    <section
      className="home-hero-carousel relative min-w-0 overflow-hidden rounded-[1.75rem] border border-brand-100 bg-[#fcf8f4] shadow-soft [contain:layout_paint]"
      aria-label="홈 배너"
      role="region"
      aria-roledescription="carousel"
      aria-live="off"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          next();
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          prev();
        }
      }}
      onTouchStart={(event) => {
        const touch = event.touches.item(0);
        if (!touch) return;
        touchStartX.current = touch.clientX;
        touchDeltaX.current = 0;
      }}
      onTouchMove={(event) => {
        if (touchStartX.current == null) return;
        const touch = event.touches.item(0);
        if (touch) touchDeltaX.current = touch.clientX - touchStartX.current;
      }}
      onTouchEnd={() => {
        const delta = touchDeltaX.current;
        touchStartX.current = null;
        touchDeltaX.current = 0;
        if (delta <= -48) next();
        else if (delta >= 48) prev();
      }}
    >
      <div
        className="flex min-w-0 transition-transform duration-500 ease-out motion-reduce:transition-none"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((slide, slideIndex) => (
          <article
            key={slide.id}
            className="grid min-w-full lg:grid-cols-[0.82fr_1.18fr]"
            aria-roledescription="slide"
            aria-label={`${slideIndex + 1} / ${slides.length}`}
            aria-hidden={slideIndex !== index}
          >
            <div className="flex min-h-[310px] flex-col justify-center px-6 py-10 sm:px-10 lg:min-h-[440px] lg:px-14">
              <p className="mb-5 text-[0.7rem] font-semibold tracking-[0.16em] text-brand-700">
                SOGANG ECONOMICS ALUMNI
              </p>
              <HeroTitle title={slide.title} />
              {slide.unpublished && isAdmin ? (
                <span className="mt-3 w-fit rounded-md bg-state-warning px-2 py-1 text-caption font-semibold text-black">
                  관리자 미리보기
                </span>
              ) : null}
              <p className="mt-5 max-w-md text-[0.95rem] leading-7 text-text-secondary md:text-base">
                {slide.description}
              </p>
              <Link
                href={{ pathname: slide.href }}
                className="mt-7 inline-flex min-h-12 w-fit items-center gap-3 rounded-full bg-brand-700 px-6 py-3 text-sm font-semibold text-white no-underline transition hover:bg-brand-800 hover:text-white hover:no-underline focus-visible:text-white focus-visible:no-underline focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                aria-label={`${slide.title} 자세히 보기`}
              >
                자세히 보기
                <ArrowRight aria-hidden="true" size={19} weight="bold" />
              </Link>
            </div>

            <div className="relative min-h-[250px] overflow-hidden lg:min-h-[440px] lg:rounded-l-[10rem]">
              <Image
                src={slide.image}
                alt=""
                fill
                className="object-cover object-center"
                sizes="(max-width: 1023px) 100vw, 60vw"
                priority={slideIndex === 0}
                quality={90}
              />
              {slides.length > 1 ? (
                <div className="absolute bottom-5 right-5 flex gap-2">
                  <button
                    type="button"
                    aria-label="이전 배너"
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/90 text-brand-800 shadow-sm transition hover:bg-white focus-visible:ring-2 focus-visible:ring-white"
                    onClick={prev}
                  >
                    <CaretLeft aria-hidden="true" size={21} weight="bold" />
                  </button>
                  <button
                    type="button"
                    aria-label="다음 배너"
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-700 text-white shadow-sm transition hover:bg-brand-800 focus-visible:ring-2 focus-visible:ring-white"
                    onClick={next}
                  >
                    <CaretRight aria-hidden="true" size={21} weight="bold" />
                  </button>
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {slides.length > 1 ? (
        <div className="absolute bottom-5 left-5 flex gap-2 lg:left-14" aria-label="배너 선택">
          {slides.map((_, slideIndex) => (
            <button
              key={`hero-dot-${slideIndex}`}
              type="button"
              aria-label={`${slideIndex + 1}번째 배너 보기`}
              aria-current={slideIndex === index ? 'true' : undefined}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-white lg:focus-visible:ring-brand-500"
              onClick={() => go(slideIndex)}
            >
              <span
                aria-hidden="true"
                className={`h-2.5 rounded-full transition-all ${
                  slideIndex === index ? 'w-7 bg-white lg:bg-brand-700' : 'w-2.5 bg-white/55 lg:bg-brand-200'
                }`}
              />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
