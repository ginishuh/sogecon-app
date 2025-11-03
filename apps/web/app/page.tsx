import Link from 'next/link';
import type { Route } from 'next';
import React from 'react';
import { HomeQuickActions } from '../components/home/quick-actions';
import HomeHeroCarousel from '../components/home/hero-carousel';

type HighlightCard = {
  href: Route;
  badge: string;
  title: string;
  description: string;
  meta: string;
};

const highlightCards: HighlightCard[] = [
  {
    href: '/directory',
    badge: '동문 수첩',
    title: '동문 수첩 베타 공개',
    description: '검색, 기수/업종 필터, 정렬 기능까지 포함된 동문 수첩을 웹에서 바로 이용하세요.',
    meta: '실시간 업데이트 중'
  },
  {
    href: '/events',
    badge: '행사',
    title: '2025 정기총회 & 런치 데이',
    description: '10월 25일 토요일, 다산관에서 열리는 오프라인+온라인 통합 런치 이벤트에 참여 신청하세요.',
    meta: 'D-17 · 현장 + 온라인'
  },
  {
    href: '/faq',
    badge: '가이드',
    title: '웹 런치 FAQ 12선',
    description: '로그인, 접근 권한, 개인정보 처리 방침 개편 내용을 Q&A 형식으로 정리했습니다.',
    meta: '업데이트: 2025-10-08'
  }
];

const stats = [
  { label: '등록 회원', value: '1,286명' },
  { label: '2025 주요 행사', value: '17건 진행' },
  { label: '장학 기금', value: '₩196,500,000' },
  { label: '운영 프로젝트 팀', value: '8개 준비' }
];

export default function HomePage() {
  return (
    <div className="flex flex-col gap-16">
      {/* 접근성/SEO용 H1 — 시각적 타이포는 캡션으로 대체 */}
      <h1 className="sr-only">서강대 경제대학원 총동문회</h1>
      {/* 새 톤: 히어로(풀블리드) → 6개 메뉴 버튼 */}
      <div className="full-bleed">
        <HomeHeroCarousel />
      </div>
      <HomeQuickActions />

      {/* 추가 섹션(About/공지/스냅숏)은 새 톤 기준에선 하단으로 이동하거나 별도 페이지에서 안내 */}

      {/* 공지 프리뷰는 제거됨(상단 단순화). 필요 시 별도 "소식" 페이지 참조 */}

      <section aria-labelledby="home-updates" className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-neutral-muted">
              공지 & 행사
            </span>
            <h2 id="home-updates" className="font-heading text-2xl text-neutral-ink md:text-3xl">
              지금 확인할 소식
            </h2>
          </div>
          <Link className="home-hero__secondary" href="/posts">
            공지 전체 보기
          </Link>
        </div>
        <div className="home-card-grid">
          {highlightCards.map((card) => (
            <Link key={card.title} href={card.href} className="home-card" aria-label={`${card.badge} · ${card.title}`}>
              <div>
                <span className="text-xs font-semibold uppercase tracking-widest text-brand-primary">{card.badge}</span>
                <h3 className="home-card__title">{card.title}</h3>
                <p className="home-card__description">{card.description}</p>
              </div>
              <div className="home-card__meta">
                <span>{card.meta}</span>
                <span>자세히</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* SSOT: 회장 인사말 카드(프리뷰) */}
      <section aria-labelledby="home-greeting" className="rounded-3xl bg-white px-6 py-7 shadow-sm md:px-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-neutral-muted">메시지</span>
            <h2 id="home-greeting" className="mt-1 font-heading text-2xl text-neutral-ink md:text-3xl">회장 인사말</h2>
            <p className="mt-2 text-sm text-neutral-muted">
              총동문회가 준비하는 디지털 허브와 2025년 운영 원칙을 간략히 소개합니다.
            </p>
          </div>
          <Link href="/about/greeting" className="home-hero__cta">전문 보기</Link>
        </div>
      </section>

      {/* SSOT: 스냅숏(마지막) */}
      <section aria-labelledby="home-stats" className="rounded-3xl bg-brand-surface px-6 py-8 shadow-sm md:px-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-neutral-muted">
              총동문회 스냅숏
            </span>
            <h2 id="home-stats" className="mt-2 font-heading text-2xl text-neutral-ink md:text-3xl">
              2025년 4분기 준비 현황
            </h2>
          </div>
          <Link className="home-hero__secondary" href="/about/org">
            조직도 자세히 보기
          </Link>
        </div>
        <dl className="mt-8 grid gap-6 text-sm text-neutral-muted md:grid-cols-4">
          {stats.map((item) => (
            <div key={item.label} className="rounded-2xl border border-neutral-border bg-white p-4 shadow-sm">
              <dt className="text-xs font-semibold uppercase tracking-widest text-neutral-muted">{item.label}</dt>
              <dd className="mt-2 text-xl font-semibold text-neutral-ink">{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
