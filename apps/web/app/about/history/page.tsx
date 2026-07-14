import React from 'react';

import { AboutHero } from '../../../components/about-hero';
import { AboutHeroPhoto } from '../../../components/about/about-hero-photo';
import { ButtonLink } from '../../../components/ui/button-link';

// 정적 페이지: 1시간 ISR 캐싱
export const revalidate = 3600;

export default function HistoryPage() {
  return (
    <div className="about-page">
      <AboutHero
        title="역대 회장단과 연혁"
        description="현재 총동문회는 9대 허민철 회장이 이끌고 있습니다. 역대 총동문회장 명단은 공식 자료를 확인한 뒤 공개하겠습니다."
        media={(
          <AboutHeroPhoto
            src="/images/about/sogang-main-gate.png"
            alt="서강대학교 정문과 교정"
            priority
          />
        )}
      />

      <section
        aria-labelledby="history-preparing-title"
        className="rounded-3xl border border-neutral-border bg-white px-6 py-12 text-center shadow-sm md:px-10 md:py-16"
      >
        <p className="text-sm font-semibold tracking-wide text-brand-700">역대 명단 확인 중</p>
        <h2
          id="history-preparing-title"
          className="mt-3 font-heading text-2xl font-semibold text-brand-primary md:text-3xl"
        >
          역대 총동문회장 명단을 준비하고 있습니다
        </h2>
        <p className="mx-auto mt-4 max-w-2xl leading-7 text-text-secondary">
          현재 9대 총동문회장은 47기 허민철 회장입니다. 이전 총동문회장 명단은 학교와 총동문회가
          보유한 자료를 대조하고 있으며, 확인을 마친 뒤 정확한 이름과 재임 기록을 공개하겠습니다.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href="/about/org">현재 조직도 보기</ButtonLink>
          <ButtonLink href="/about/class-presidents" variant="secondary">
            역대 원우회장 보기
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
