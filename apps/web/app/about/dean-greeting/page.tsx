import Link from 'next/link';
import React from 'react';

import { DeanGreetingBanner } from '../../../components/about/dean-greeting-banner';

// 정적 페이지: 1시간 ISR 캐싱
export const revalidate = 3600;

export default function DeanGreetingPage() {
  return (
    <div className="about-page">
      <DeanGreetingBanner priority />

      <section className="about-section about-section--stacked">
        <div className="about-section__content mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">경제대학원장 김도영</p>
          <h2 className="about-section__heading">
            서강대학교 경제대학원에 오신 것을 환영합니다
          </h2>

          <p>
            경제대학원은 경제 전문 인력 육성을 목적으로 1991년 개원한 국내 최초의 경제학 분야 특수대학원입니다.
            실용적인 경제 지식을 전수하는 경제 교육기관의 역할을 담당해 왔으며, 그동안 3,000여 명의 경제학 석사를
            배출하였고 현재 300명이 넘는 원우들이 학업에 정진하고 있습니다.
          </p>

          <p>
            &lsquo;서강학파&rsquo;로 불리는 서강대학교 경제대학 및 경제대학원 교수진은 현대 경제학에 근거한 실용적 연구와
            선구적 교육으로 경제대학원 인재 양성에 기여해 왔습니다. 경제대학원 동문들은 금융기관, 기업, 정부,
            법조계 등 다양한 분야에서 활동하며 &lsquo;신서강학파&rsquo;라는 이름으로 맹활약하고 있습니다.
          </p>

          <p>
            저희 교수와 직원 일동은 그동안의 성과에 안주하지 않고, 경제대학원을 변화하는 시대적 요구에 부응하는
            교육기관으로 발전시키기 위해 계속 노력할 것입니다. 경제대학원 동문 및 재학 원우 여러분의 지속적인 관심과
            애정으로 경제대학원이 새로운 사회가 요구하는 인재의 산실로 거듭날 것이라 확신합니다.
          </p>

          <p>
            앞으로도 우리 경제대학원에 지속적인 관심과 성원을 부탁드립니다.
          </p>

          <div className="mt-4 border-t border-neutral-border pt-6 text-right text-text-primary">
            <p className="text-sm">서강대학교 경제대학원</p>
            <p className="mt-1 font-heading text-xl font-semibold">김도영 원장</p>
          </div>

          <p className="text-sm text-text-muted">
            인사말은 <a href="https://econ.sogang.ac.kr/econ/1708/subview.do" target="_blank" rel="noreferrer" className="text-link inline-flex min-h-11 items-center">서강대학교 경제대학 공식 홈페이지</a>를 기준으로 반영했습니다.
            내용의 수정이 필요하면 <Link href="/support/contact" className="text-link inline-flex min-h-11 items-center">동문회 사무국에 알려 주세요.</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
