import Link from 'next/link';
import type { Route } from 'next';
import React from 'react';

type QuickAction = {
  href: Route;
  label: string;
  ariaLabel?: string;
  bgColor: string;
  icon: React.ReactNode;
  showPlusIcon?: boolean;
};

const ACTIONS: QuickAction[] = [
  {
    href: '/about/greeting' as Route,
    label: '총동문회 소개',
    ariaLabel: '총동문회 소개 바로가기',
    bgColor: 'bg-[#8a1e2d]',
    showPlusIcon: true,
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 13.33L16 4l12 9.33v13.34a2.67 2.67 0 0 1-2.67 2.66H6.67A2.67 2.67 0 0 1 4 26.67V13.33Z" />
        <path d="M12 29.33V16h8v13.33" />
      </svg>
    )
  },
  {
    href: '/directory',
    label: '동문 수첩',
    ariaLabel: '동문 수첩 바로가기',
    bgColor: 'bg-[#6c1722]',
    showPlusIcon: true,
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M5.33 8h21.34M5.33 13.33h21.34M5.33 18.67h13.34" />
      </svg>
    )
  },
  {
    href: '/events',
    label: '행사 일정',
    ariaLabel: '행사 일정 바로가기',
    bgColor: 'bg-yellow-600',
    showPlusIcon: true,
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="5.33" width="24" height="21.34" rx="2.67" />
        <path d="M10.67 2.67v5.33M21.33 2.67v5.33M4 13.33h24" />
      </svg>
    )
  },
  {
    href: '/posts',
    label: '총동문회 소식',
    ariaLabel: '총동문회 소식 바로가기',
    bgColor: 'bg-teal-700',
    showPlusIcon: true,
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2.67" y="2.67" width="21.33" height="26.66" rx="2.67" />
        <path d="M24 8h5.33v16a2.67 2.67 0 0 1-2.66 2.67H24V8Z" />
      </svg>
    )
  },
  {
    href: '/board?tab=discussion' as Route,
    label: '자유게시판',
    ariaLabel: '자유게시판 바로가기',
    bgColor: 'bg-[#b08968]',
    showPlusIcon: true,
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 6.67h24v18.66a2.67 2.67 0 0 1-2.67 2.67H10.67l-6.67 4V6.67Z" />
      </svg>
    )
  },
  {
    href: '/board?tab=congrats' as Route,
    label: '경조사 게시판',
    ariaLabel: '경조사 게시판 바로가기',
    bgColor: 'bg-slate-700',
    showPlusIcon: true,
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M8 20l8 8M24 8l-8 8M20 24h4v-4" />
        <circle cx="16" cy="16" r="2.67" />
      </svg>
    )
  }
];

export function HomeQuickActions() {
  return (
    <section aria-labelledby="home-quick-actions" className="mt-8">
      <h2 id="home-quick-actions" className="sr-only">빠른 실행</h2>
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {ACTIONS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.ariaLabel ?? item.label}
            className={`relative flex flex-col items-center justify-center h-[107px] rounded-2xl shadow-md transition-transform hover:scale-105 ${item.bgColor}`}
          >
            {/* 아이콘 */}
            <div className="text-white mb-2" aria-hidden="true">
              {item.icon}
            </div>

            {/* 라벨 */}
            <span className="text-sm font-normal text-white">{item.label}</span>

            {/* 우상단 + 아이콘 */}
            {item.showPlusIcon && (
              <div className="absolute top-2 right-2 flex items-center justify-center w-5 h-5 rounded-full bg-white/20">
                <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 1v10M1 6h10" />
                </svg>
              </div>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}

export default HomeQuickActions;
