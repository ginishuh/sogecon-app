import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';
import React from 'react';

type GreetingCard = {
  title: string;
  href: Route;
  imageSrc: string;
  imageAlt: string;
  imageWidth: number;
  imageHeight: number;
};

const GREETING_CARDS: GreetingCard[] = [
  {
    title: '총동문회장 인사말',
    href: '/about/greeting',
    imageSrc: '/images/about/greeting-card.webp',
    imageAlt: '총동문회장 인사말 이미지 미리보기',
    imageWidth: 1200,
    imageHeight: 670
  },
  {
    title: '대학원장 인사말',
    href: '/about/dean-greeting',
    imageSrc: '/images/about/greeting-dean-card.webp',
    imageAlt: '대학원장 인사말 이미지 미리보기',
    imageWidth: 1200,
    imageHeight: 670
  }
];

/**
 * 홈 페이지 인사말 섹션
 * 인사말 페이지로 연결되는 카드 (모바일: 세로, 데스크톱: 2열)
 */
export function HomeGreetingCard() {
  return (
    <section aria-labelledby="home-greeting" className="mt-12 space-y-4 border-t border-neutral-border pt-8">
      <div>
        <p className="text-xs font-semibold text-brand-700">서강경제의 인연</p>
        <h2 id="home-greeting" className="mt-1 text-xl font-semibold text-text-primary">함께 만드는 동문회</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">총동문회와 경제대학원이 전하는 인사에서 우리가 이어갈 방향을 만나보세요.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {GREETING_CARDS.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            aria-label={card.title}
            className="group relative block aspect-16/9 overflow-hidden rounded-2xl bg-neutral-subtle focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
          >
            <Image
              src={card.imageSrc}
              alt={card.imageAlt}
              width={card.imageWidth}
              height={card.imageHeight}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              sizes="(min-width: 768px) 50vw, 100vw"
            />
          </Link>
        ))}
      </div>
    </section>
  );
}

export default HomeGreetingCard;
