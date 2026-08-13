import type { Metadata } from 'next';
import React from 'react';

import { AboutHero } from '../../../../components/about-hero';
import { AboutHeroPhoto } from '../../../../components/about/about-hero-photo';
import { ButtonLink } from '../../../../components/ui/button-link';
import { SOGANG_ECONOMICS_AWARD_LAUREATES } from '../../../../lib/regular-programs';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: '서강경제대상',
  description:
    '서강대학교 경제대학원과 경제대학원 총동문회가 해마다 교수와 동문에게 수여하는 서강경제대상을 소개합니다.',
};

export default function SogangEconomicsAwardPage() {
  return (
    <div className="about-page">
      <AboutHero
        title="서강경제대상"
        description="경제대학원과 총동문회가 공동으로 수여하는 상입니다. 시상식은 보통 송년의 밤과 함께 열리며, 날짜와 장소는 해마다 달라집니다."
        media={(
          <AboutHeroPhoto
            src="/images/about/sogang-economics-award-hero.webp"
            alt="금빛 메달과 마룬 리본으로 표현한 서강경제대상 상징"
            objectPosition="center 42%"
            priority
          />
        )}
      />

      <section className="about-section about-section--stacked">
        <div className="about-section__content mx-auto max-w-3xl">
          <h2 className="about-section__heading">어떤 상인가요</h2>
          <p>
            서강경제대상은 서강대학교 경제대학원과 경제대학원 총동문회가 자유시장주의 경제학 분야에서
            연구 업적이 뛰어난 교수와, 국가 경제에 기여한 동문을 선정해 수여하는 상입니다.
          </p>
          <p>
            2025년에 15회를 맞았습니다. 교수 부문과 동문 부문으로 나누어 시상하며, 구체적인 일정은
            행사 안내에서 확인하시면 됩니다.
          </p>
        </div>
      </section>

      <section
        aria-labelledby="award-laureates-title"
        className="rounded-3xl border border-neutral-border bg-white px-4 py-8 shadow-sm md:px-10 md:py-12"
      >
        <div className="mx-auto max-w-5xl">
          <h2
            id="award-laureates-title"
            className="font-heading text-2xl font-semibold text-brand-primary md:text-3xl"
          >
            최근 수상자
          </h2>

          <div className="mt-8 overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <caption className="sr-only">서강경제대상 최근 수상자</caption>
              <thead>
                <tr className="border-b border-neutral-border text-text-muted">
                  <th scope="col" className="px-3 py-3 font-semibold">연도</th>
                  <th scope="col" className="px-3 py-3 font-semibold">회차</th>
                  <th scope="col" className="px-3 py-3 font-semibold">교수 부문</th>
                  <th scope="col" className="px-3 py-3 font-semibold">동문 부문</th>
                </tr>
              </thead>
              <tbody>
                {SOGANG_ECONOMICS_AWARD_LAUREATES.map((row) => (
                  <tr key={row.year} className="border-b border-neutral-border last:border-0">
                    <th scope="row" className="px-3 py-4 font-medium text-text-primary">
                      {row.year}
                    </th>
                    <td className="px-3 py-4 text-text-secondary">{row.edition}회</td>
                    <td className="px-3 py-4 text-text-primary">{row.faculty}</td>
                    <td className="px-3 py-4 text-text-primary">{row.alumni}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/events">행사 일정 보기</ButtonLink>
            <ButtonLink href="/about/programs" variant="secondary">
              정규 행사 목록
            </ButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
}
