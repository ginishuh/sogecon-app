import Image from 'next/image';
import React from 'react';
import { AboutHero } from '../../../components/about-hero';

const commitments = [
  {
    title: '연결과 협력',
    body: '세대와 기수를 넘나드는 연결을 촉진하고, 선후배가 함께 배우는 교류의 장을 만드는 것이 최우선입니다.'
  },
  {
    title: '지속 가능한 성장',
    body: '총원우회의 재정·인적 자원을 투명하게 관리하고, 구성원의 성장을 지원하는 프로그램을 꾸준히 확장하겠습니다.'
  },
  {
    title: '사회적 책임',
    body: '지역사회와 학교 발전에 기여하고, 동문 지식의 선순환을 위해 사회공헌 프로젝트를 준비하고 있습니다.'
  }
];

export default function GreetingPage() {
  return (
    <div className="about-page">
      <AboutHero
        title="회장 인사말"
        description="총원우회 16대 회장 김서강입니다. 서로 다른 경험을 가진 동문이 마음껏 도전하고 성장할 수 있도록, 든든한 동반자가 되겠습니다."
        image={{ src: '/images/about/greeting-hero.svg', alt: '총원우회 서강대 캠퍼스 풍경 삽화', priority: true }}
      />

      <section aria-labelledby="greeting-vision-title" className="about-section">
        <div className="about-section__content">
          <h2 id="greeting-vision-title" className="about-section__heading">
            동문이 함께 만드는 미래
          </h2>
          <p>
            총원우회는 지난 30여 년 동안 끊임없는 교류와 협력으로 성장해 왔습니다. 올해는 디지털 전환과
            온·오프라인 행사를 통해 전국의 동문이 언제든지 연결될 수 있는 기반을 마련하는 데 집중하고자 합니다.
          </p>
          <p>
            동문 여러분 한 분, 한 분이 주인공입니다. 총원우회 활동을 통해 쌓인 경험과 지식을 나누어 각자의
            커리어와 삶이 더 단단해질 수 있도록 함께하겠습니다.
          </p>
        </div>
        <figure aria-label="총원우회 비전 다이어그램" className="about-section__figure">
          <Image
            src="/images/about/greeting-detail.svg"
            alt="총원우회의 비전을 상징하는 원형 다이어그램"
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
            총원우회가 추구하는 핵심 가치를 세 가지로 정리했습니다. 모든 사업과 모임은 이 가치 위에서 기획하고,
            결과를 투명하게 공유하겠습니다.
          </p>
        </div>
        <ul className="about-section__list" aria-label="총원우회 운영 원칙 목록">
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
