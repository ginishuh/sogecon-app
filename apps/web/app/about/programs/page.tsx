import type { Metadata } from 'next';
import Link from 'next/link';
import React from 'react';

import { AboutHero } from '../../../components/about-hero';
import { AboutHeroPhoto } from '../../../components/about/about-hero-photo';
import { ButtonLink } from '../../../components/ui/button-link';
import { REGULAR_PROGRAMS } from '../../../lib/regular-programs';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: '정규 행사',
  description:
    '서강대 경제대학원 총동문회가 해마다 이어 온 정규 프로그램을 소개합니다. 구체적인 일정은 행사 일정에서 확인하세요.',
};

export default function RegularProgramsPage() {
  return (
    <div className="about-page">
      <AboutHero
        title="정규 행사"
        description="날짜와 장소는 해마다 달라집니다. 여기서는 동문회가 꾸준히 이어 온 프로그램을 소개하고, 이번 회차 일정은 행사 안내에서 확인하시면 됩니다."
        media={(
          <AboutHeroPhoto
            src="/images/about/sogang-economics-award-hero.webp"
            alt="금빛 메달과 마룬 리본으로 표현한 서강경제대상 상징"
            objectPosition="center"
            priority
          />
        )}
      />

      <section aria-labelledby="regular-programs-list" className="rounded-3xl bg-brand-surface px-4 py-8 md:px-10 md:py-12">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-semibold tracking-wide text-brand-700">총동문회 프로그램</p>
          <h2
            id="regular-programs-list"
            className="mt-2 font-heading text-2xl font-semibold text-brand-primary md:text-3xl"
          >
            먼저 서강경제대상을 소개합니다
          </h2>
          <p className="mt-3 max-w-3xl leading-7 text-text-secondary">
            앞으로 다른 정규 프로그램도 이 메뉴에 모을 예정입니다. 일정 확인과 참가 신청은 행사 일정을 이용해 주세요.
          </p>

          <ul className="mt-8 grid gap-4">
            {REGULAR_PROGRAMS.map((program) => (
              <li key={program.href}>
                <Link
                  href={program.href}
                  className="about-section__card block no-underline transition hover:border-brand-200 hover:no-underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-700"
                >
                  <p className="text-sm font-semibold text-brand-700">정규 프로그램</p>
                  <h3 className="about-section__card-title mt-1">{program.title}</h3>
                  <p className="mt-2 leading-6 text-text-secondary">{program.summary}</p>
                  <p className="mt-4 text-sm font-semibold text-brand-800">자세히 보기</p>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/events">행사 일정 보기</ButtonLink>
            <ButtonLink href="/support/contact" variant="secondary">
              사무국에 문의하기
            </ButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
}
