import Image from 'next/image';
import React from 'react';
import { AboutHero } from '../../../components/about-hero';

const commitments = [
  {
    title: '디지털 허브 완성',
    body: '2025년 하반기 웹 런치를 통해 언제 어디서든 행사·공지·수첩을 확인할 수 있는 원스톱 허브를 완성하겠습니다.'
  },
  {
    title: '투명한 재정과 보고',
    body: '회비·기금 집행 내역을 분기별 리포트와 데이터 대시보드로 공개하고, 회원 질문에 48시간 이내 응답하는 체계를 유지하겠습니다.'
  },
  {
    title: '함께 성장하는 커뮤니티',
    body: '현직·동문 멘토링과 산업별 라운드테이블을 정례화해 기수와 세대를 아우르는 실질적인 성장을 지원하겠습니다.'
  }
];

export default function GreetingPage() {
  return (
    <div className="about-page">
      <AboutHero
        title="회장 인사말"
        description="총동문회 16대 회장 김서강입니다. 2025년 웹 서비스 런치와 함께, 동문 누구나 쉽게 소식을 접하고 의견을 나눌 수 있는 열린 커뮤니티를 만들겠습니다."
        image={{ src: '/images/about/greeting-hero.svg', alt: '총동문회 서강대 캠퍼스 풍경 삽화', priority: true }}
      />

      <section aria-labelledby="greeting-vision-title" className="about-section">
        <div className="about-section__content">
          <h2 id="greeting-vision-title" className="about-section__heading">
            동문이 함께 만드는 미래
          </h2>
          <p>
            지난 30년 동안 총동문회는 서로의 지식과 경험을 나누며 성장해 왔습니다. 이제는 모바일과 웹 어디서나
            같은 정보를 볼 수 있도록 디지털 전환을 완성해, 멀리 떨어진 동문도 실시간으로 소식을 접할 수 있는
            환경을 구축하고 있습니다.
          </p>
          <p>
            2025년에는 정기총회와 산업별 라운드테이블, ESG 프로젝트를 아우르는 ‘공유 달력’을 운영해 참여 동선을
            단순화할 예정입니다. 동문 여러분 한 분, 한 분의 제안이 정책과 프로그램으로 이어지도록 의견 수렴 창구도
            상시로 열어 두겠습니다.
          </p>
        </div>
        <figure aria-label="총동문회 비전 다이어그램" className="about-section__figure">
          <Image
            src="/images/about/greeting-detail.svg"
            alt="총동문회의 비전을 상징하는 원형 다이어그램"
            width={520}
            height={360}
            className="h-auto w-full rounded-lg object-cover shadow-sm"
          />
        </figure>
      </section>

      <section aria-labelledby="greeting-commitments-title" className="about-section about-section--stacked">
        <div className="about-section__content">
          <h2 id="greeting-commitments-title" className="about-section__heading">
            약속드리는 세 가지 방향
          </h2>
          <p>
            총동문회가 추구하는 핵심 가치를 세 가지로 정리했습니다. 모든 사업과 모임은 이 가치 위에서 기획하고,
            결과를 투명하게 공유하겠습니다.
          </p>
        </div>
        <ul className="about-section__list" aria-label="총동문회 운영 원칙 목록">
          {commitments.map((item) => (
            <li key={item.title} className="about-section__card">
              <h3 className="about-section__card-title">{item.title}</h3>
              <p>{item.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
