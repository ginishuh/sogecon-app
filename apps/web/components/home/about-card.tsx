import Link from 'next/link';
import React from 'react';

export function AboutPromoCard() {
  return (
    <section aria-labelledby="about-promo" className="flex flex-col gap-4">
      <div className="home-card-grid">
        <Link href="/about/greeting" className="home-card" aria-label="총동문회 소개 · 인사말·연혁·조직">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-brand-primary">총동문회 소개</span>
            <h3 id="about-promo" className="home-card__title">인사말 · 연혁 · 조직</h3>
            <p className="home-card__description">총동문회의 이야기와 구조를 한눈에 확인하세요.</p>
          </div>
          <div className="home-card__meta">
            <span>소개</span>
            <span>자세히 보기 →</span>
          </div>
        </Link>
      </div>
    </section>
  );
}

export default AboutPromoCard;

