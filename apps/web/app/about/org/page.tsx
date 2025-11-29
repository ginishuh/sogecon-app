import Image from 'next/image';
import React from 'react';
import { AboutHero } from '../../../components/about-hero';

// 정적 페이지: 1시간 ISR 캐싱
export const revalidate = 3600;

const committees = [
  {
    name: '집행위원회',
    description:
      '연간 사업계획과 예산을 수립하고, 회칙/규정 개정 절차를 관리합니다. 모든 안건과 지출은 분기 총회에서 공개합니다.'
  },
  {
    name: '기획분과',
    description:
      '산업별 네트워킹, ESG 프로젝트, 장학사업 등 신규 프로그램을 설계합니다. 2025년에는 금융·테크·공공 분야 협업을 우선 추진합니다.'
  },
  {
    name: '회원분과',
    description:
      '회원 데이터베이스 정비와 입회/재등록 지원, 복지 프로그램 운영을 담당합니다. 개인정보 보호와 접근성 가이드를 준수해 서비스 품질을 유지합니다.'
  },
  {
    name: '소통분과',
    description:
      '뉴스레터·SNS·홈페이지 업데이트를 통합 관리하고, 문의 대응 SLA(48시간)를 모니터링합니다. 내·외부 커뮤니케이션 일정을 조율합니다.'
  }
];

const contactPoints = [
  { label: '사무국 대표 메일', value: 'office@sogang-econ-alumni.kr' },
  { label: '대표 전화', value: '02-715-1234 (ARS 2번: 행사/협업)' },
  { label: '운영시간', value: '평일 10:00 - 17:00 (점심 12:00 - 13:00)' },
  { label: '주소', value: '서울 마포구 백범로 35, 서강대학교 경제대학원 3층 총동문회 사무국' }
];

export default function OrgPage() {
  return (
    <div className="about-page">
      <AboutHero
        title="조직도"
        description="총동문회는 회장단, 집행부, 감사단, 자문위원으로 구성되어 각자의 책임을 분담합니다. 모든 회의록과 결산 자료는 회원 전용 아카이브에 공개합니다."
        image={{ src: '/images/about/org-hero.svg', alt: '총동문회 조직 구성을 보여주는 삽화', priority: true }}
      />

      <section aria-labelledby="org-structure" className="about-section">
        <div className="about-section__content">
          <h2 id="org-structure" className="about-section__heading">
            회장단과 집행부
          </h2>
          <p>
            회장단은 회장, 수석부회장, 부회장단, 감사단으로 구성되어 전략 방향과 연간 사업계획을 수립합니다. 집행부는
            실행 조직으로서 각 분과의 목표를 조정하고, 회원 접점을 통해 수집된 피드백을 정리해 회장단에 보고합니다.
          </p>
          <p>
            모든 분과는 담당자를 두 명 이상 배치해 견제와 협업 구조를 유지하며, 주요 안건은 월 1회 열리는 운영위원회에서
            논의 후 공지합니다. 분기별로 공개하는 리포트에는 KPI 달성 현황과 다음 분기 계획이 포함됩니다.
          </p>
        </div>
        <figure aria-label="총동문회 조직 계층 구조" className="about-section__figure">
          <Image
            src="/images/about/org-chart.svg"
            alt="회장단, 집행부, 자문위원으로 구성된 조직도"
            width={520}
            height={360}
            className="h-auto w-full rounded-lg object-cover shadow-sm"
          />
        </figure>
      </section>

      <section aria-labelledby="org-committees" className="about-section about-section--stacked">
        <div className="about-section__content">
          <h2 id="org-committees" className="about-section__heading">
            분과별 주요 역할
          </h2>
          <p>
            각 분과는 연초에 정량 목표와 예산 사용 계획을 공지하고, 분기별 성과와 지출 내역을 대시보드와 PDF 리포트로 공유합니다.
            주요 지표는 KPI 보드에서 실시간으로 확인할 수 있습니다.
          </p>
        </div>
        <ul className="about-section__list" aria-label="분과 역할 목록">
          {committees.map((committee) => (
            <li key={committee.name} className="about-section__card">
              <h3 className="about-section__card-title">{committee.name}</h3>
              <p>{committee.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="org-contact" className="about-section about-section--highlight">
        <div className="about-section__content">
          <h2 id="org-contact" className="about-section__heading">
            연락 및 협업 채널
          </h2>
          <p>
            공식 창구를 통해 모든 문의를 받고 있습니다. 회비 관련 문의, 협업 제안, 행사 대관 등은 사무국에서
            담당자를 지정하여 응대합니다.
          </p>
        </div>
        <dl className="about-contact-list" aria-label="사무국 연락처 정보">
          {contactPoints.map((item) => (
            <div key={item.label} className="about-contact-list__item">
              <dt className="about-contact-list__term">{item.label}</dt>
              <dd className="about-contact-list__description">{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
