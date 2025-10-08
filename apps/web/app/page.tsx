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
    href: '/posts',
    badge: '공지',
    title: '11월 운영위원회 요약',
    description: '회칙 개정 초안, 신규 멤버십 혜택, ESG 프로젝트 착수 현황을 요약했습니다.',
    meta: '게시: 2025-10-05'
  },
  {
    href: '/events',
    badge: '행사',
    title: '2025 정기총회 & 홈커밍',
    description: '10월 25일 토요일, 서강대학교 다산관에서 열리는 정기총회에 참여 신청하세요.',
    meta: 'D-17 · 현장 + 온라인'
  },
  {
    href: '/about/greeting',
    badge: '소개',
    title: '16대 회장단 인사말',
    description: '새로운 회장단이 준비한 비전과 3대 핵심 추진 과제를 먼저 만나보세요.',
    meta: '총원우회 소개 바로가기'
  }
];

const stats = [
  { label: '등록 회원', value: '1,248명' },
  { label: '2025 주요 행사', value: '12건 예정' },
  { label: '장학 기금', value: '₩186,000,000' },
  { label: '커뮤니티 모임', value: '24개 운영' }
];

export default function HomePage() {
  return (
    <div className="flex flex-col gap-16">
      <section aria-labelledby="home-hero" className="home-hero">
        <div>
          <span className="home-hero__eyebrow">웹 런치 프리뷰</span>
          <h1 id="home-hero" className="home-hero__title">
            총원우회 활동을 한눈에, 어디서든 함께
          </h1>
          <p className="home-hero__description">
            홈 화면에서 행사 일정, 공지, 소개 페이지까지 바로 연결됩니다. 모바일에서도 동일한 경험을 제공하며,
            푸시 알림과 회원 전용 기능은 곧 이어집니다.
          </p>
          <div className="home-hero__actions" role="group" aria-label="주요 행동">
            <Link className="home-hero__cta" href="/events">
              다가오는 행사 보기
            </Link>
            <Link className="home-hero__secondary" href="/posts">
              최신 공지 확인
            </Link>
          </div>
          <dl className="mt-6 grid gap-4 text-sm text-neutral-muted md:grid-cols-2" aria-label="2025년 하이라이트 지표">
            <div>
              <dt className="text-xs uppercase tracking-widest text-neutral-muted">다음 행사</dt>
              <dd className="font-semibold text-neutral-ink">10월 정기총회 · 10월 25일(토) 14:00</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-widest text-neutral-muted">공지 업데이트</dt>
              <dd className="font-semibold text-neutral-ink">10월 5일 운영위원회 결과 요약</dd>
            </div>
          </dl>
        </div>
        <div className="home-hero__image">
          <Image
            src="/images/home/hero.svg"
            alt="총원우회 홈 영웅 이미지"
            width={480}
            height={360}
            className="h-auto w-full rounded-2xl object-cover shadow-soft"
            priority
          />
        </div>
      </section>

      <section aria-labelledby="home-stats" className="rounded-3xl bg-brand-surface px-6 py-8 shadow-sm md:px-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-neutral-muted">
              총원우회 스냅숏
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
