import Link from 'next/link';
import type { Route } from 'next';
import React from 'react';

type QuickAction = {
  href: Route;
  label: string;
  description: string;
  ariaLabel?: string;
};

const ACTIONS: QuickAction[] = [
  { href: '/directory', label: '동문 수첩', description: '이름/기수로 검색', ariaLabel: '동문 수첩 바로가기' },
  { href: '/events', label: '행사', description: '일정 확인/신청', ariaLabel: '행사 바로가기' },
  { href: '/posts', label: '소식', description: '공지/뉴스 모아보기', ariaLabel: '총동문회 소식 바로가기' },
  { href: '/board', label: '게시판', description: '자유·질문·정보', ariaLabel: '커뮤니티 게시판 바로가기' },
];

export function HomeQuickActions() {
  return (
    <section aria-labelledby="home-quick-actions" className="home-quick-actions">
      <div className="flex items-baseline justify-between">
        <h2 id="home-quick-actions" className="font-heading text-2xl text-neutral-ink md:text-3xl">
          빠른 실행
        </h2>
        <span className="text-xs font-semibold uppercase tracking-widest text-neutral-muted">Shortcuts</span>
      </div>
      <ul className="home-quick-actions__grid" role="list" aria-label="빠른 실행 링크">
        {ACTIONS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-label={item.ariaLabel ?? item.label}
              className="home-quick-actions__item"
            >
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

