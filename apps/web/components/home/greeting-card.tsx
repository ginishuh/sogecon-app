import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

type GreetingCard = {
  title: string;
  href: string;
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
    <section aria-labelledby="home-greeting" className="mt-8">
      <h2 id="home-greeting" className="sr-only">
        인사말
      </h2>

      <div className="grid gap-4 md:grid-cols-2">
        {GREETING_CARDS.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            aria-label={card.title}
            className="block overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
          >
            <Image
              src={card.imageSrc}
              alt={card.imageAlt}
              width={card.imageWidth}
              height={card.imageHeight}
              className="h-auto w-full object-contain"
              sizes="(min-width: 768px) 50vw, 100vw"
            />
          </Link>
        ))}
      </div>
    </section>
  );
}

export default HomeGreetingCard;
