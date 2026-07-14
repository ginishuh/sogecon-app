import Link from 'next/link';
import React from 'react';

import { AboutHero } from '../../../components/about-hero';
import { AboutHeroPhoto } from '../../../components/about/about-hero-photo';
import { ClassPresidentList } from '../../../components/about/class-president-list';
import { CLASS_PRESIDENT_SOURCE, CLASS_PRESIDENTS } from '../../../lib/class-presidents';

export const revalidate = 3600;

export default function ClassPresidentsPage() {
  return (
    <div className="about-page">
      <AboutHero
        title="역대 기수별 원우회장"
        description="각 기수의 원우회를 이끌며 서강 경제의 인연을 이어 온 회장들을 한자리에 모았습니다. 기수와 이름, 당시 공개된 근무처로 빠르게 찾아볼 수 있습니다."
        media={(
          <AboutHeroPhoto
            src="/images/about/sogang-albatross-tower.png"
            alt="서강대학교 알바트로스탑"
            objectPosition="center 46%"
          />
        )}
      />

      <section aria-labelledby="class-president-list" className="rounded-3xl bg-brand-surface px-4 py-8 md:px-10 md:py-12">
        <div className="mb-8 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">원우회 기록</p>
          <h2 id="class-president-list" className="mt-2 font-heading text-2xl font-semibold text-brand-primary md:text-3xl">
            기수별 회장 명단
          </h2>
          <p className="mt-3 leading-7 text-text-secondary">
            서강대학교 경제대학 공식 홈페이지에 공개된 명단을 기준으로 정리했습니다. 원문에 없는 31기와 33기는 임의로 채우지 않고 미기재 상태로 표시했습니다.
          </p>
        </div>

        <ClassPresidentList presidents={CLASS_PRESIDENTS} />

        <p className="mt-8 border-t border-neutral-border pt-5 text-sm leading-6 text-text-muted">
          명단의 수정이 필요하면 <Link href="/support/contact" className="text-link inline-flex min-h-11 items-center">동문회 사무국에 알려 주세요.</Link>{' '}
          <a href={CLASS_PRESIDENT_SOURCE} target="_blank" rel="noreferrer" className="text-link inline-flex min-h-11 items-center">서강대학교 경제대학 원문 보기</a>
        </p>
      </section>
    </div>
  );
}
