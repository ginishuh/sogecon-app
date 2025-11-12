import Link from 'next/link';
import React from 'react';

/**
 * 홈 페이지 동문회장 인사말 섹션
 * /about/greeting 페이지로 연결되는 카드
 */
export function HomeGreetingCard() {
  return (
    <section aria-labelledby="home-greeting" className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 id="home-greeting" className="text-base font-normal text-neutral-ink">
          동문회장 인사말
        </h2>
        <Link
          href="/about/greeting"
          className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-primary text-white hover:bg-brand-primaryDark transition-colors"
          aria-label="동문회장 인사말 전체 보기"
        >
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 10h10M10 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>

      <Link
        href="/about/greeting"
        className="block border border-neutral-border rounded-xl p-6 hover:bg-neutral-surface/50 transition-colors"
      >
        <div className="flex items-start gap-4">
          {/* 아이콘 */}
          <div className="shrink-0 w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0" strokeLinecap="round" />
            </svg>
          </div>

          {/* 텍스트 */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-medium text-neutral-ink mb-2">
              동문 여러분을 환영합니다
            </h3>
            <p className="text-sm text-neutral-muted leading-relaxed line-clamp-3">
              서강대학교 경제대학원 총동문회는 동문 간의 친목 도모와 상호 발전을 위해
              다양한 활동을 전개하고 있습니다. 동문회장의 인사말을 확인해보세요.
            </p>
          </div>

          {/* 화살표 아이콘 (모바일에서는 숨김) */}
          <div className="hidden md:block shrink-0 text-neutral-muted">
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 10h10M10 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </Link>
    </section>
  );
}

export default HomeGreetingCard;
