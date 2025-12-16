import Image from 'next/image';
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
        <h2 id="home-greeting" className="font-kopub text-base text-neutral-ink">
          동문회장 인사말
        </h2>
        <Link
          href="/about/greeting"
          className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-primary hover:bg-brand-primaryDark transition-colors"
          aria-label="동문회장 인사말 전체 보기"
        >
          <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 10h10M10 5l5 5-5 5" />
          </svg>
        </Link>
      </div>

      <Link
        href="/about/greeting"
        aria-label="동문회장 인사말 보기"
        className="block overflow-hidden border border-neutral-border rounded-xl hover:bg-neutral-surface/50 transition-colors"
      >
        <div className="p-5 md:p-6">
          <div className="relative overflow-hidden rounded-xl bg-white p-3 md:p-4">
            <div className="md:hidden">
              <Image
                src="/images/about/greeting-card.png"
                alt="총동문회장 인사말 이미지 미리보기"
                width={1200}
                height={613}
                className="h-auto w-full object-contain"
                sizes="100vw"
              />
            </div>
            <div className="hidden md:block">
              <Image
                src="/images/about/greeting-card-desktop.png"
                alt="총동문회장 인사말 이미지 미리보기"
                width={1200}
                height={320}
                className="h-auto w-full object-contain"
                sizes="(min-width: 1024px) 896px, 100vw"
              />
            </div>
          </div>
        </div>
      </Link>
    </section>
  );
}

export default HomeGreetingCard;
