import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';
import React from 'react';

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
    badge: '수첩',
    title: '동문 수첩 베타 공개',
    description: '검색, 기수/업종 필터, 정렬 기능까지 포함된 수첩을 웹에서 바로 이용하세요.',
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
      <section aria-labelledby="home-hero" className="home-hero">
        <div>
          <span className="home-hero__eyebrow">2025 웹 런치</span>
          <h1 id="home-hero" className="home-hero__title">
            한 번의 로그인으로 동문 네트워크 전체를
          </h1>
          <p className="home-hero__description">
            공지, 행사, 수첩, 소개 페이지를 하나의 홈에서 연결했습니다. 모바일에서도 동일한 경험을 제공하며,
            2025년 4분기부터는 푸시 알림과 회원 전용 기능을 순차적으로 공개합니다.
          </p>
          <div className="home-hero__actions" role="group" aria-label="주요 행동">
            <Link className="home-hero__cta" href="/directory">
              동문 수첩 열기
            </Link>
            <Link className="home-hero__secondary" href="/faq">
              자주 묻는 질문
            </Link>
          </div>
          <dl className="mt-6 grid gap-4 text-sm text-neutral-muted md:grid-cols-2" aria-label="2025년 하이라이트 지표">
            <div>
              <dt className="text-xs uppercase tracking-widest text-neutral-muted">다음 행사</dt>
              <dd className="font-semibold text-neutral-ink">정기총회 & 런치 데이 · 10월 25일(토) 14:00</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-widest text-neutral-muted">공지 업데이트</dt>
              <dd className="font-semibold text-neutral-ink">FAQ/정책 문서 최종본 · 10월 8일 게시</dd>
            </div>
          </dl>
        </div>
        <div className="home-hero__image">
          <Image
            src="/images/home/hero-launch.svg"
            alt="웹 런치를 기념하는 총동문회 일러스트"
            width={480}
            height={360}
            className="h-auto w-full rounded-2xl object-cover shadow-soft"
            sizes="(max-width: 768px) 100vw, 480px"
            priority
          />
        </div>
      </section>

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
    </div>
  );
}
