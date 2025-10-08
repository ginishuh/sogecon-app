import Image from 'next/image';
import React from 'react';
import { AboutHero } from '../../../components/about-hero';

const committees = [
  {
    name: '집행위원회',
    description:
      '정기 모임 기획, 예산 집행, 대외 협력 등 총원우회의 일상 운영을 관리합니다. 분기별 운영 리포트를 공개합니다.'
  },
  {
    name: '기획분과',
    description:
      '신규 프로그램과 동문 대상 강연, 산업별 소모임을 기획합니다. 올해는 금융·테크·문화 영역을 우선으로 진행합니다.'
  },
  {
    name: '회원분과',
    description:
      '회원 데이터베이스 정비, 입회/재등록 지원, 회원복지 프로그램을 운영합니다. 개인정보 보호와 접근성 정책을 준수합니다.'
  }
];

const contactPoints = [
  { label: '사무국 대표 메일', value: 'office@sogang-econ-alumni.kr' },
  { label: '운영시간', value: '평일 10:00 - 17:00 (점심 12:00 - 13:00)' },
  { label: '주소', value: '서울 마포구 백범로 35, 서강대학교 경제대학원 3층 총원우회 사무국' }
];

export default function OrgPage() {
  return (
    <div className="about-page">
      <AboutHero
        title="조직도"
        description="총원우회는 회장단과 집행부, 자문위원, 감사단이 분담하여 운영합니다. 각 조직은 분기별 운영 성과를 보고하고, 모든 문서는 회원에게 투명하게 공개합니다."
        image={{ src: '/images/about/org-hero.svg', alt: '총원우회 조직 구성을 보여주는 삽화' }}
      />

      <section aria-labelledby="org-structure" className="about-section">
        <div className="about-section__content">
          <h2 id="org-structure" className="about-section__heading">
            회장단과 집행부
          </h2>
          <p>
            회장단은 회장, 수석부회장, 부회장단, 감사단으로 구성됩니다. 회장단은 전략 방향과 연간 사업계획을
            수립하고, 집행부는 이를 실행하며 회원과의 접점을 관리합니다.
          </p>
          <p>
            각 분과는 최소 2인 이상으로 구성되어 상호 견제와 협업 체계를 유지합니다. 주요 안건은 월 1회 열리는
            운영위원회에서 논의 후 공지합니다.
          </p>
        </div>
        <figure aria-label="총원우회 조직 계층 구조" className="about-section__figure">
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
            모든 분과는 연초에 정량 목표와 예산 사용 계획을 공지하며, 분기별로 성과와 지출 내역을 보고합니다.
            문서는 회원 전용 게시판에서 열람할 수 있습니다.
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
