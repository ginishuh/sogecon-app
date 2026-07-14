import Link from 'next/link';
import React from 'react';

import { AboutHero } from '../../../components/about-hero';
import { AboutHeroPhoto } from '../../../components/about/about-hero-photo';

export const revalidate = 3600;

type Officer = {
  role: string;
  name: string;
  cohort: number;
};

const president: Officer = { role: '회장', name: '허민철', cohort: 47 };
const audit: Officer = { role: '감사 및 운영', name: '최창선', cohort: 53 };
const secretariat: Officer = { role: '사무국장', name: '황승환', cohort: 55 };
const divisionLead: Officer = { role: '분과 운영 총괄국장', name: '노준영', cohort: 55 };

const directors: Officer[] = [
  { role: '이사', name: '이윤권', cohort: 57 },
  { role: '이사', name: '이정은', cohort: 57 }
];

const committees: Officer[] = [
  { role: 'ESG 연구 분과위원장', name: '김형중', cohort: 48 },
  { role: '실물자산·부동산 분과위원장', name: '노준영', cohort: 55 }
];

function OfficerCard({ officer, emphasis = false }: { officer: Officer; emphasis?: boolean }) {
  return (
    <article className={`rounded-2xl border p-5 text-center ${emphasis ? 'border-brand-800 bg-brand-800 text-white shadow-soft' : 'border-neutral-border bg-white text-text-primary shadow-sm'}`}>
      <p className={`text-sm font-semibold ${emphasis ? 'text-white/75' : 'text-brand-700'}`}>{officer.role}</p>
      <p className="mt-2 font-heading text-xl font-bold">{officer.name}</p>
      <p className={`mt-1 text-sm ${emphasis ? 'text-white/75' : 'text-text-muted'}`}>{officer.cohort}기</p>
    </article>
  );
}

export default function OrgPage() {
  return (
    <div className="about-page">
      <AboutHero
        title="동문회 조직도"
        description="회장과 감사, 사무국, 분과 운영진이 역할을 나누고 동문들의 의견을 실제 사업과 모임으로 연결합니다. 현재 운영진과 담당 영역을 한눈에 확인해 보세요."
        media={(
          <AboutHeroPhoto
            src="/images/home/alumni-networking-hero.webp"
            alt="행사장에서 대화를 나누는 서강 경제 동문들"
            objectPosition="56% center"
            priority
          />
        )}
      />

      <section aria-labelledby="org-chart" className="rounded-3xl bg-brand-surface px-4 py-8 md:px-10 md:py-12">
        <div className="mx-auto max-w-5xl">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">총동문회 운영진</p>
            <h2 id="org-chart" className="mt-2 font-heading text-2xl font-semibold text-brand-primary md:text-3xl">현재 운영진과 역할</h2>
            <p className="mt-3 leading-7 text-text-secondary">회장단과 사무국, 분과 운영진이 역할을 나누어 동문회 일정과 교류 사업을 함께 이끌고 있습니다. 각 담당 영역과 운영진을 아래에서 확인해 보세요.</p>
          </div>

          <div className="mt-10 space-y-8 md:space-y-10" aria-label="총동문회 조직 계층">
            <section aria-labelledby="governance-title" className="rounded-3xl border border-brand-100 bg-white p-5 shadow-sm md:p-7">
              <div className="mb-5 flex items-center gap-4">
                <h3 id="governance-title" className="shrink-0 font-heading text-lg font-semibold text-brand-primary">운영 방향과 점검</h3>
                <span aria-hidden="true" className="h-px flex-1 bg-brand-100" />
              </div>
              <div className="grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
                <OfficerCard officer={president} emphasis />
                <OfficerCard officer={audit} />
              </div>
            </section>

            <section aria-labelledby="operations-title">
              <div className="mb-5 flex items-center gap-4">
                <h3 id="operations-title" className="shrink-0 font-heading text-lg font-semibold text-brand-primary">실행 조직</h3>
                <span aria-hidden="true" className="h-px flex-1 bg-brand-200" />
              </div>
              <div className="grid gap-6 md:grid-cols-2 md:gap-8">
                <section aria-labelledby="secretariat-title" className="rounded-3xl border border-neutral-border bg-white p-5 shadow-sm md:p-7">
                  <div id="secretariat-title"><OfficerCard officer={secretariat} /></div>
                  <p className="mt-5 text-sm leading-6 text-text-secondary">동문회 운영과 회원 접점을 맡아 일정, 협업, 문의를 조율합니다.</p>
                  <ul className="mt-5 divide-y divide-neutral-border border-t border-neutral-border" aria-label="사무국 이사">
                    {directors.map((officer) => (
                      <li key={officer.name} className="flex min-h-16 items-center justify-between gap-4 py-3">
                        <span className="text-sm font-semibold text-brand-700">{officer.role}</span>
                        <span className="text-right font-medium text-text-primary">{officer.name}<span className="ml-1 text-sm font-normal text-text-muted">({officer.cohort}기)</span></span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section aria-labelledby="division-title" className="rounded-3xl border border-brand-200 bg-white p-5 shadow-sm md:p-7">
                  <div id="division-title"><OfficerCard officer={divisionLead} /></div>
                  <p className="mt-5 text-sm leading-6 text-text-secondary">관심 분야별 연구와 교류 프로그램을 기획하고 분과 활동을 연결합니다.</p>
                  <ul className="mt-5 divide-y divide-neutral-border border-t border-neutral-border" aria-label="분과위원장">
                    {committees.map((officer) => (
                      <li key={officer.role} className="grid min-h-20 gap-1 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
                        <span className="text-sm font-semibold leading-6 text-brand-700">{officer.role}</span>
                        <span className="font-medium text-text-primary sm:text-right">{officer.name}<span className="ml-1 text-sm font-normal text-text-muted">({officer.cohort}기)</span></span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </section>
          </div>
        </div>
      </section>

      <section aria-labelledby="org-contact" className="rounded-3xl border border-neutral-border bg-white px-6 py-8 shadow-sm md:flex md:items-center md:justify-between md:gap-8 md:px-10">
        <div>
          <h2 id="org-contact" className="font-heading text-xl font-semibold text-brand-primary md:text-2xl">운영진에게 전할 말이 있나요?</h2>
          <p className="mt-2 max-w-2xl leading-7 text-text-secondary">행사 제안, 분과 활동, 명단 수정 등 동문회 운영에 관한 의견은 사무국에서 담당자에게 연결합니다.</p>
        </div>
        <Link href="/support/contact" className="mt-5 inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-brand-primary px-6 font-semibold text-white no-underline transition hover:bg-brand-800 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 md:mt-0">사무국에 문의하기</Link>
      </section>
    </div>
  );
}
