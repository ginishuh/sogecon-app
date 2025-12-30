import React from 'react';
import { AboutHero } from '../../../components/about-hero';

// 정적 페이지: 1시간 ISR 캐싱
export const revalidate = 3600;

const focusAreas = [
  {
    title: '동문 네트워크 확장',
    body: '재학생과 동문이 함께 성장할 수 있도록 멘토링과 공동 프로젝트를 정례화하겠습니다.'
  },
  {
    title: '실무-학문 연결',
    body: '산업 현장과 연구 성과가 유기적으로 연결되도록 산학 협력 프로그램을 강화하겠습니다.'
  },
  {
    title: '지속 가능한 리더십',
    body: '윤리·ESG 관점의 리더십 교육을 확대해 사회에 기여하는 동문 리더를 키우겠습니다.'
  }
];

export default function DeanGreetingPage() {
  return (
    <div className="about-page">
      <AboutHero
        title="대학원장 인사말"
        description="경제대학원장으로서 동문과 재학생이 함께 배우고 성장하는 공동체를 만들기 위해 최선을 다하겠습니다."
        image={{ src: '/images/about/greeting-hero.svg', alt: '경제대학원 캠퍼스 풍경 삽화', priority: true }}
      />

      <section aria-labelledby="dean-greeting-vision" className="about-section">
        <div className="about-section__content">
          <h2 id="dean-greeting-vision" className="about-section__heading">
            함께 만들어가는 교육 플랫폼
          </h2>
          <p>
            경제대학원은 변화하는 산업 환경 속에서 실무와 학문을 연결하는 교육을 지속해 왔습니다. 앞으로는 총동문회와의
            협력을 확대해 동문 네트워크를 교육과 연구로 연결하고, 재학생의 역량을 현장에서 바로 발휘할 수 있도록
            지원하겠습니다.
          </p>
          <p>
            여러분의 경험과 제안을 학교의 성장 동력으로 삼아, 동문이 자부심을 느끼는 교육 플랫폼을 함께 만들어가겠습니다.
          </p>
        </div>
      </section>

      <section aria-labelledby="dean-greeting-focus" className="about-section about-section--stacked">
        <div className="about-section__content">
          <h2 id="dean-greeting-focus" className="about-section__heading">
            핵심 추진 방향
          </h2>
          <p>교육 혁신과 동문 네트워크 강화를 위한 세 가지 축을 제시합니다.</p>
        </div>
        <ul className="about-section__list" aria-label="대학원장 인사말 핵심 방향 목록">
          {focusAreas.map((item) => (
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
