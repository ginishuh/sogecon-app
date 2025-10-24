import Image from 'next/image';
import React from 'react';
import { AboutHero } from '../../../components/about-hero';

const milestones = [
  {
    year: '1994',
    title: '총동문회 창립',
    body: '첫 4개 기수가 연합해 총동문회를 창립하고, 서강대학교 경제대학원 동문 네트워크의 기반을 마련했습니다.'
  },
  {
    year: '2005',
    title: '장학기금 조성',
    body: '동문 기부로 장학기금을 조성해 재학생 후배 지원을 시작했습니다. 현재는 연간 12명에게 장학금을 지급합니다.'
  },
  {
    year: '2016',
    title: '디지털 커뮤니티 전환',
    body: '회원 포털과 모바일 알림 시스템을 도입해 행사 신청, 회비 납부, 커뮤니티 운영을 온라인으로 전환했습니다.'
  },
  {
    year: '2022',
    title: '데이터 거버넌스 강화',
    body: '회원 데이터 거버넌스 정책과 접근 로그 감사를 도입해 개인정보 보호와 투명한 데이터 사용 체계를 구축했습니다.'
  },
  {
    year: '2025',
    title: '공식 웹 런치',
    body: '웹·모바일 통합 경험을 제공하는 공식 웹을 오픈하고, 디렉터리/공지/행사/소개를 한 번에 연결하도록 개편했습니다.'
  }
];

const pastPresidents = [
  { term: '13대', name: '박지원', period: '2018 - 2019', focus: '디지털 전환, 회원 데이터베이스 정비' },
  { term: '14대', name: '이상훈', period: '2020 - 2021', focus: '비대면 운영 체계 확립, 온라인 세미나 확대' },
  { term: '15대', name: '정아름', period: '2022 - 2023', focus: '장학 사업 확장, ESG 프로젝트 준비' },
  { term: '16대', name: '김서강', period: '2024 - 2025', focus: '웹 런치, 데이터 투명성, 산업별 라운드테이블 상시화' }
];

export default function HistoryPage() {
  return (
    <div className="about-page">
      <AboutHero
        title="역대 회장단과 연혁"
        description="총동문회는 1994년 창립 이후 30년 넘게 동문 교류와 사회 공헌을 이어왔습니다. 연혁과 역대 회장단의 주요 활동을 한눈에 정리했습니다."
        image={{ src: '/images/about/history-hero.svg', alt: '총동문회 연혁을 상징하는 타임라인 삽화' }}
      />

      <section aria-labelledby="history-timeline" className="about-section about-section--timeline">
        <div className="about-section__content">
          <h2 id="history-timeline" className="about-section__heading">
            주요 연혁
          </h2>
          <p>
            동문회의 발자취를 간략히 정리했습니다. 연간 사업 보고서와 자료실에서 더 자세한 기록을 확인할 수 있으며,
            2025년부터는 주요 지표를 데이터 보드로 시각화해 제공할 예정입니다.
          </p>
        </div>
        <ol className="about-timeline" aria-label="총동문회 주요 연혁">
          {milestones.map((item) => (
            <li key={item.year} className="about-timeline__item">
              <div className="about-timeline__marker" aria-hidden />
              <div className="about-timeline__content">
                <span className="about-timeline__year">{item.year}</span>
                <h3 className="about-timeline__title">{item.title}</h3>
                <p>{item.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="history-presidents" className="about-section about-section--stacked">
        <div className="about-section__content">
          <h2 id="history-presidents" className="about-section__heading">
            역대 회장단
          </h2>
          <p>
            지난 6년간 총동문회를 이끌어 주신 회장단입니다. 각 회장단의 주요 사업과 과제를 간략히 소개합니다.
          </p>
        </div>
        <ul className="about-section__list" aria-label="역대 회장단 소개">
          {pastPresidents.map((president) => (
            <li key={president.term} className="about-section__card">
              <h3 className="about-section__card-title">{`${president.term} 회장 ${president.name}`}</h3>
              <dl className="about-section__dl">
                <div>
                  <dt>활동 기간</dt>
                  <dd>{president.period}</dd>
                </div>
                <div>
                  <dt>주요 과제</dt>
                  <dd>{president.focus}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="history-archive" className="about-section">
        <div className="about-section__content">
          <h2 id="history-archive" className="about-section__heading">
            자료실 미리보기
          </h2>
          <p>
            연간 사업 보고서, 회계 감사 보고, 총회 의사록 등은 로그인한 회원에게 순차적으로 열람 권한을 제공할 예정입니다.
            정식 오픈 전까지는 핵심 항목만 요약으로 제공하며, 열람 신청이 많은 문서는 우선 공개합니다.
          </p>
          <p>
            자료 공개 범위에 대한 의견은 언제든 사무국으로 전해주세요. 공개 시기와 형식을 구성원과 함께 결정하겠습니다.
          </p>
        </div>
        <figure aria-label="자료 보관소 이미지" className="about-section__figure">
          <Image
            src="/images/about/history-archive.svg"
            alt="자료실 서가를 묘사한 일러스트"
            width={520}
            height={360}
            className="h-auto w-full rounded-lg object-cover shadow-sm"
          />
        </figure>
      </section>
    </div>
  );
}
