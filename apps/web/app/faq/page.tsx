import type { Metadata } from 'next';
import Link from 'next/link';
import React from 'react';

export const metadata: Metadata = {
  title: '자주 묻는 질문',
  description:
    '총원우회 웹 런치와 함께 변경되는 로그인 방식, 디렉터리 열람 기준, 개인정보 처리 절차를 정리했습니다. 추가 문의는 사무국으로 연락해 주세요.'
};

type FAQSection = {
  id: string;
  title: string;
  description: string;
  items: {
    question: string;
    answer: React.ReactNode;
  }[];
};

const faqSections: FAQSection[] = [
  {
    id: 'access',
    title: '계정 및 접근',
    description: '로그인, 인증, 권한에 대한 핵심 질문을 정리했습니다.',
    items: [
      {
        question: '웹 런치 이후 로그인 방식은 어떻게 바뀌나요?',
        answer: (
          <>
            학번(ID)과 초기 비밀번호 체계는 유지되지만, 최초 로그인 시 본인 확인 후 반드시 새로운 비밀번호를 설정해야 합니다.
            <br />
            비활성 상태인 회원은 <strong>회원활성화</strong> 메뉴에서 본인 인증(생년월일 또는 등록 이메일) 절차를 진행해 주세요.
          </>
        )
      },
      {
        question: '동문이 아니라도 디렉터리를 볼 수 있나요?',
        answer: (
          <>
            아니요. 디렉터리와 회원 프로필은 활성화된 총원우회 회원만 열람할 수 있습니다. 로그인하지 않은 사용자는 기본 안내 페이지만 볼 수 있으며,
            본문 접근 시 로그인 화면으로 리다이렉트됩니다.
          </>
        )
      },
      {
        question: '로그인에 실패했을 때 무엇을 확인해야 하나요?',
        answer: (
          <>
            비밀번호 재설정 링크는 <em>가입 시 등록한 이메일</em>로 발송됩니다. 메일을 받지 못했다면 스팸함을 확인하거나{' '}
            <a href="mailto:office@sogang-econ-alumni.kr">office@sogang-econ-alumni.kr</a>로 문의해 주세요. 5회 이상 연속 실패 시
            보안을 위해 10분간 로그인이 제한됩니다.
          </>
        )
      }
    ]
  },
  {
    id: 'features',
    title: '서비스 기능',
    description: '홈 화면, 공지, 행사, 디렉터리에서 자주 묻는 질문을 모았습니다.',
    items: [
      {
        question: '홈 화면에서 어떤 정보를 빠르게 확인할 수 있나요?',
        answer: (
          <>
            히어로 영역에서 다음 행사를 확인하고, 공지·FAQ·디렉터리 바로가기 카드를 통해 주요 기능으로 이동할 수 있습니다.
            모바일에서도 동일한 레이아웃을 제공하며, 즐겨찾기 버튼을 이용하면 홈 화면에 바로가기 아이콘을 추가할 수 있습니다.
          </>
        )
      },
      {
        question: '디렉터리 검색은 어떤 방식으로 작동하나요?',
        answer: (
          <>
            이름·이메일 키워드 검색과 함께 기수, 업종, 지역, 회사, 전공 필터를 지원합니다. 필터를 변경하면 350ms 디바운스를 거친 후 자동으로 URL이
            업데이트돼, 공유 링크에 현재 검색 조건이 반영됩니다.
          </>
        )
      },
      {
        question: '행사와 공지는 어디서 관리하나요?',
        answer: (
          <>
            일반 회원은 홈과 <Link href="/events">행사 페이지</Link>에서 최신 일정을 확인할 수 있습니다. 운영진은 관리자 콘솔에 로그인해 공지/행사
            등록, 푸시 발송, 통계 확인을 진행합니다.
          </>
        )
      }
    ]
  },
  {
    id: 'policy',
    title: '정책 및 지원',
    description: '개인정보 처리와 문의 채널을 안내합니다.',
    items: [
      {
        question: '개인정보는 어디에 저장되며 어떻게 보호되나요?',
        answer: (
          <>
            회원 정보는 암호화된 데이터베이스에 저장되며, 관리자 접근은 역할 기반 권한(RBAC)으로 제한됩니다. 열람 기록은 1년간 감사 로그에 보관되고,
            404/410 응답을 반환하는 푸시 구독 정보는 즉시 폐기됩니다. 자세한 내용은{' '}
            <Link href="/privacy" prefetch={false}>
              개인정보 처리방침
            </Link>
            을 참고하세요.
          </>
        )
      },
      {
        question: '정책 문서는 어디에서 확인할 수 있나요?',
        answer: (
          <>
            본 페이지와 함께 <Link href="/terms">이용약관</Link>, <Link href="/privacy">개인정보 처리방침</Link>을 제공합니다. 문서 버전은 꼬리말에
            명시되며, 개정 시 등록 이메일로 사전 안내를 드립니다.
          </>
        )
      },
      {
        question: '문의는 어떤 채널을 이용하면 되나요?',
        answer: (
          <>
            사무국 대표 메일(<a href="mailto:office@sogang-econ-alumni.kr">office@sogang-econ-alumni.kr</a>) 또는 대표 전화(02-715-1234)로 연락해 주세요.
            평일 10:00-17:00에 응대하며, 주말 문의는 다음 영업일에 순차 처리합니다.
          </>
        )
      }
    ]
  }
];

export default function FAQPage() {
  return (
    <div className="space-y-12 rounded-3xl bg-white px-6 py-12 shadow-soft md:px-12">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-muted">Support</p>
        <h1 className="font-heading text-3xl text-neutral-ink md:text-4xl">자주 묻는 질문</h1>
        <p className="text-sm leading-6 text-neutral-muted">
          웹 런치와 함께 달라지는 회원 경험을 문답 형식으로 정리했습니다. 빠르게 궁금증을 해결하고, 추가 문의는 사무국으로 남겨 주세요.
        </p>
      </header>

      <div className="grid gap-8 md:grid-cols-2">
        {faqSections.map((section) => (
          <section key={section.id} aria-labelledby={`${section.id}-title`} className="space-y-4 rounded-2xl border border-neutral-border bg-white/70 p-6 shadow-sm">
            <div className="space-y-2">
              <h2 id={`${section.id}-title`} className="font-heading text-xl text-brand-primary">
                {section.title}
              </h2>
              <p className="text-sm text-neutral-muted">{section.description}</p>
            </div>
            <dl aria-label={`${section.title} 질문 목록`} className="space-y-5">
              {section.items.map((item) => (
                <div key={item.question} className="rounded-xl bg-brand-surface/60 p-4">
                  <dt className="text-sm font-semibold text-neutral-ink">{item.question}</dt>
                  <dd className="mt-2 text-sm leading-6 text-neutral-muted">{item.answer}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <section aria-labelledby="faq-support" className="rounded-2xl bg-brand-surface px-6 py-6 text-sm text-neutral-muted md:py-8">
        <h2 id="faq-support" className="font-heading text-lg text-brand-primary">
          추가로 궁금한 점이 있다면
        </h2>
        <p className="mt-2">
          사무국 대표 메일 <a className="underline decoration-brand-accent decoration-2 underline-offset-4" href="mailto:office@sogang-econ-alumni.kr">office@sogang-econ-alumni.kr</a> 또는
          대표 번호 02-715-1234(ARS 2번)로 연락해 주세요. 평균 응답 시간은 영업일 기준 24시간 이내입니다.
        </p>
      </section>

      <p className="text-xs uppercase tracking-widest text-neutral-muted">문서 버전: 2025-10-08</p>
    </div>
  );
}
