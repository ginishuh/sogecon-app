import type { Metadata } from 'next';
import Link from 'next/link';
import React from 'react';

// 정적 페이지: 1시간 ISR 캐싱
export const revalidate = 3600;

export const metadata: Metadata = {
  title: '자주 묻는 질문',
  description:
    '총동문회 웹 런치와 함께 변경되는 로그인 방식, 동문 수첩 열람 기준, 개인정보 처리 절차를 정리했습니다. 추가 문의는 사무국으로 연락해 주세요.'
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
            아직 첫 로그인을 설정하지 않은 회원은<strong className="mx-1">첫 로그인 설정</strong>메뉴에서 안내받은 코드와 새 비밀번호를 입력해 주세요.
          </>
        )
      },
      {
        question: '동문이 아니라도 동문 수첩을 볼 수 있나요?',
        answer: (
          <>
            아니요. 동문 수첩과 회원 프로필은 가입 승인을 받고 로그인한 총동문회 회원만 열람할 수 있습니다. 로그인하지 않은 사용자는 기본 안내 페이지만 볼 수 있으며,
            동문 전용 화면에 접근하면 로그인 화면으로 이동합니다.
          </>
        )
      },
      {
        question: '로그인에 실패했을 때 무엇을 확인해야 하나요?',
        answer: (
          <>
            비밀번호 재설정 링크는 <em>가입 시 등록한 이메일</em>로 발송됩니다. 메일을 받지 못했다면 스팸함을 확인하거나{' '}
            <a className="text-link" href="mailto:office@sogang-econ-alumni.kr">office@sogang-econ-alumni.kr</a>로 문의해 주세요. 5회 이상 연속 실패 시
            보안을 위해 10분간 로그인이 제한됩니다.
          </>
        )
      }
    ]
  },
  {
    id: 'features',
    title: '서비스 기능',
    description: '홈 화면, 공지, 행사, 동문 수첩에서 자주 묻는 질문을 모았습니다.',
    items: [
      {
        question: '홈 화면에서 어떤 정보를 빠르게 확인할 수 있나요?',
        answer: (
          <>
            히어로 영역에서 다음 행사를 확인하고, 공지·FAQ·동문 수첩 바로가기 카드를 통해 주요 기능으로 이동할 수 있습니다.
            모바일에서도 동일한 레이아웃을 제공하며, 즐겨찾기 버튼을 이용하면 홈 화면에 바로가기 아이콘을 추가할 수 있습니다.
          </>
        )
      },
      {
        question: '동문 수첩 검색은 어떤 방식으로 작동하나요?',
        answer: (
          <>
            이름·이메일 검색과 함께 기수, 업종, 지역, 회사, 전공 조건을 선택할 수 있습니다. 검색 조건을 바꾸면 결과와 주소가 자동으로 갱신되어,
            현재 검색 조건을 그대로 공유할 수 있습니다.
          </>
        )
      },
      {
        question: '행사와 공지는 어디서 관리하나요?',
        answer: (
          <>
            일반 회원은 홈과 <Link className="text-link" href="/events">행사 페이지</Link>에서 최신 일정을 확인할 수 있습니다. 동문회 운영진은 운영 메뉴에서 공지와 행사를
            등록하고 새 소식 알림과 이용 현황을 관리합니다.
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
            회원 정보는 암호화해 저장하며, 담당 업무에 필요한 사람만 접근할 수 있습니다. 열람 기록은 1년간 보관하고,
            더 이상 사용할 수 없는 알림 연결 정보는 즉시 삭제합니다. 자세한 내용은
            <Link className="ml-1 text-link" href="/privacy" prefetch={false}>
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
            본 페이지와 함께 <Link className="text-link" href="/terms">이용약관</Link>, <Link className="text-link" href="/privacy">개인정보 처리방침</Link>을 제공합니다. 문서 버전은 꼬리말에
            명시되며, 개정 시 등록 이메일로 사전 안내를 드립니다.
          </>
        )
      },
      {
        question: '문의는 어떤 채널을 이용하면 되나요?',
        answer: (
          <>
            사무국 대표 메일(<a className="text-link" href="mailto:office@sogang-econ-alumni.kr">office@sogang-econ-alumni.kr</a>) 또는 대표 전화(02-715-1234)로 연락해 주세요.
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
