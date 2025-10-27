import Link from 'next/link';
import type { Route } from 'next';
import React from 'react';

type QuickAction = {
  href: Route;
  label: string;
  description: string;
  ariaLabel?: string;
  theme: 'rose' | 'emerald' | 'sky' | 'amber' | 'indigo' | 'slate';
};

const ACTIONS: QuickAction[] = [
  { href: '/about/greeting', label: '총동문회 소개', description: '인사말·연혁·조직', ariaLabel: '총동문회 소개 바로가기', theme: 'indigo' },
  { href: '/directory', label: '총동문회 수첩', description: '이름/기수로 검색', ariaLabel: '총동문회 수첩 바로가기', theme: 'emerald' },
  { href: '/events', label: '총동문회 행사', description: '일정 확인/신청', ariaLabel: '총동문회 행사 바로가기', theme: 'amber' },
  { href: '/posts', label: '총동문회 소식', description: '공지/뉴스 모아보기', ariaLabel: '총동문회 소식 바로가기', theme: 'sky' },
  { href: '/board?tab=discussion' as Route, label: '자유게시판', description: '자유 주제 토론', ariaLabel: '자유게시판 바로가기', theme: 'slate' },
  { href: '/board?tab=share' as Route, label: '경조사 게시판', description: '축하/부고 소식', ariaLabel: '경조사 게시판 바로가기', theme: 'rose' },
];

function ActionIcon({ label }: { label: string }) {
  // 간단한 일러스트 스타일의 라인 아이콘 — 장치/테마 무관하게 안전한 색/크기
  // 접근성: 장식 목적이므로 aria-hidden
  const common = 'h-5 w-5';
  if (label.includes('수첩')) {
    // 주소록/카드
    return (
      <svg aria-hidden="true" className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </svg>
    );
  }
  if (label.includes('행사')) {
    // 달력
    return (
      <svg aria-hidden="true" className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 9h18M8 14h3M13 14h3M8 18h3" />
      </svg>
    );
  }
  if (label.includes('소식')) {
    // 신문/메가폰 느낌의 뉴스 카드
    return (
      <svg aria-hidden="true" className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="5" width="14" height="14" rx="2" />
        <path d="M5.5 8h9M5.5 11h9M5.5 14h6" />
        <path d="M17 9l4 2v6a2 2 0 0 1-2 2h-2V9Z" />
      </svg>
    );
  }
  // 게시판: 대화 말풍선
  return (
    <svg aria-hidden="true" className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 6h16v9a2 2 0 0 1-2 2H9l-5 3V6Z" />
      <path d="M8 10h8M8 13h6" />
    </svg>
  );
}

export function HomeQuickActions() {
  return (
    <section aria-labelledby="home-quick-actions" className="home-quick-actions">
      {/* 시각적 헤더 제거 — 접근성용으로만 유지 */}
      <h2 id="home-quick-actions" className="sr-only">빠른 실행</h2>
      <ul className="home-quick-actions__grid" role="list" aria-label="빠른 실행 링크">
        {ACTIONS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-label={item.ariaLabel ?? item.label}
              className={`home-quick-actions__item qa-${item.theme}`}
            >
              <span className="home-quick-actions__icon" aria-hidden="true">
                <ActionIcon label={item.label} />
              </span>
              <span className="home-quick-actions__label">{item.label}</span>
              <span className="home-quick-actions__desc">{item.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default HomeQuickActions;
