import Image from 'next/image';
import React from 'react';

// 정적 페이지: 1시간 ISR 캐싱
export const revalidate = 3600;

export default function GreetingPage() {
  return (
    <div className="about-page">
      {/* 히어로: 카드 이미지 */}
      <section className="w-full">
        <Image
          src="/images/about/greeting-card.webp"
          alt="총동문회장 인사말"
          width={1200}
          height={670}
          className="w-full h-auto"
          priority
        />
      </section>

      {/* 본문: 단일 섹션 */}
      <section className="about-section about-section--stacked">
        <div className="about-section__content max-w-3xl mx-auto">
          <h2 className="about-section__heading text-center">
            &lsquo;서강학파&rsquo;의 일원이 되신 것을 환영합니다
          </h2>

          <p>
            동문 여러분, 반갑습니다.
            저는 서강대학교 경제대학원 제11대 동문회장을 맡게 된 47기 허민철입니다.
          </p>

          <p>
            우리 서강대학교 경제대학원은 &lsquo;서강학파&rsquo;라는 대한민국 경제학계의 자랑스러운 전통 위에서,
            시대를 선도하는 교육과 연구를 통해 동문들이 사회 각계에서 중추적 역할을 수행할 수 있도록 끊임없이 발전해왔습니다.
            한강의 기적을 설계한 남덕우 전 총리님을 비롯하여, 역대 경제부총리와 금융통화위원,
            그리고 수많은 경제 리더들을 배출한 우리 대학원은 이제 AI 경제, ESG 경영, 디지털 금융 등
            새로운 경제 패러다임을 선도하는 인재 양성의 요람으로 자리매김하고 있습니다.
          </p>

          <p>
            저는 동문회장으로서 전통을 계승하되 혁신을 더하여,
            동문 여러분이 함께 성장하고 서로의 성공이 곧 우리 모두의 자산이 되는 역동적인 동문회를 만들어가겠습니다.
            특히 실질적인 비즈니스 네트워킹, 세대를 아우르는 멘토링 프로그램,
            그리고 정책 포럼과 학술 세미나를 통한 사회 기여에 역점을 두겠습니다.
          </p>

          <p>
            동문 여러분의 적극적인 참여와 성원이 우리 동문회 발전의 원동력입니다.
            박성수 원장님과 교수님들, 그리고 신명식 전임 회장님의 헌신적인 노력에 감사드리며,
            모든 동문 여러분과 함께 서강 경제대학원의 새로운 도약을 이루어가겠습니다.
          </p>

          <p className="font-medium">
            감사합니다.
          </p>
        </div>
      </section>
    </div>
  );
}
