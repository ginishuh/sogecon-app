import type { Metadata } from 'next';
import React from 'react';

// 정적 페이지: 1시간 ISR 캐싱
export const revalidate = 3600;

export const metadata: Metadata = {
  title: '개인정보 처리방침',
  description:
    '서강대 경제대학원 총동문회는 회원 개인정보를 안전하게 보호하기 위해 수집 항목, 이용 목적, 보유 기간, 제3자 제공 기준을 명확히 고지합니다.'
};

type PolicySection = {
  id: string;
  title: string;
  summary: string;
  content: React.ReactNode;
};

const sections: PolicySection[] = [
  {
    id: 'collection',
    title: '1. 수집하는 개인정보 항목',
    summary: '회원 가입 및 서비스 이용 과정에서 필요한 최소한의 개인정보만 수집합니다.',
    content: (
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong>필수 항목</strong> · 학번(ID), 이름, 기수, 생년월일(본인확인용), 이메일, 휴대전화, 가입 승인 기록
        </li>
        <li>
          <strong>선택 항목</strong> · 전공, 직장명, 직함, 업종, 주소(개인/직장), 프로필 이미지
        </li>
        <li>서비스 이용 기록(로그인 일시, 접속 IP, 기기 정보), 문의 및 상담 기록, 푸시 구독 토큰</li>
      </ul>
    )
  },
  {
    id: 'purpose',
    title: '2. 개인정보 이용 목적',
    summary: '명시된 목적 범위 내에서만 개인정보를 이용하며, 목적 변경 시 별도 동의를 받습니다.',
    content: (
      <ol className="list-decimal space-y-2 pl-5">
        <li>회원 식별 및 로그인, 계정 활성화·재설정 등 서비스 기본 기능 제공</li>
        <li>행사/공지/수첩 운영을 위한 회원 정보 검증과 연락</li>
        <li>장학사업, 프로그램 안내, 총회 공지 등 커뮤니케이션 발송</li>
        <li>서비스 안정성 확보, 보안 로그 분석, 이용 통계 작성</li>
      </ol>
    )
  },
  {
    id: 'retention',
    title: '3. 보유 및 이용 기간',
    summary: '회원 탈퇴 후 6개월 보관 후 파기하며, 법령이 정한 기간은 별도 보관합니다.',
    content: (
      <ul className="list-disc space-y-2 pl-5">
        <li>회원 DB: 탈퇴 시 지체 없이 파기, 단 분쟁 대응을 위해 6개월간 최소 정보(이름, 연락처) 보관</li>
        <li>로그 기록: 통신비밀보호법에 따라 12개월 보관 후 파기</li>
        <li>장학·재정 관련 증빙: 국세기본법 등 관련 법령에 따라 최대 5년 보관</li>
      </ul>
    )
  },
  {
    id: 'third-party',
    title: '4. 제3자 제공 및 위탁',
    summary: '법령 근거가 있거나 회원 동의를 받은 경우에 한해 외부에 제공합니다.',
    content: (
      <>
        <p>
          총동문회는 원칙적으로 회원 개인정보를 외부에 제공하지 않습니다. 다만 다음의 경우에는 예외적으로 제공할 수 있으며,
          제공 시 사전 고지 및 동의를 진행합니다.
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>회원 동의가 있는 경우</li>
          <li>법령에 따라 수사기관 등으로부터 적법한 절차에 따라 제공 요청이 있는 경우</li>
          <li>클라우드 인프라, 문자 발송 등 서비스 운영에 필요한 위탁이 필요한 경우</li>
        </ul>
        <p className="mt-3">
          현재 위탁 현황은 AWS(인프라 운영), Twilio(알림 발송)이며, 위탁 계약 시 안전성 확보를 위한 조치를 명시합니다.
        </p>
      </>
    )
  },
  {
    id: 'rights',
    title: '5. 이용자 권리와 행사 방법',
    summary: '언제든지 개인정보 열람, 정정, 삭제, 처리정지를 요청할 수 있습니다.',
    content: (
      <ul className="list-disc space-y-2 pl-5">
        <li>
          회원은 <strong>마이페이지 &gt; 개인정보 수정</strong>에서 직접 정보를 열람·수정할 수 있습니다.
        </li>
        <li>
          삭제 또는 처리정지를 원할 경우 사무국 대표 이메일(office@sogang-econ-alumni.kr)로 신청해 주세요. 접수일로부터 7일 이내 처리 결과를
          안내합니다.
        </li>
        <li>대리인을 통한 요청은 위임장과 본인 신분증 사본을 제출해야 하며, 30일 이내 답변드립니다.</li>
      </ul>
    )
  },
  {
    id: 'security',
    title: '6. 개인정보 보호를 위한 기술적·관리적 대책',
    summary: '암호화, 접근 통제, 로그 모니터링 등 다양한 보안 조치를 적용합니다.',
    content: (
      <ul className="list-disc space-y-2 pl-5">
        <li>비밀번호·연락처 등 주요 정보는 암호화 저장하며, TLS로 전송 구간을 보호합니다.</li>
        <li>관리자 계정은 다중 인증(MFA)을 필수로 적용하고, 역할 기반 권한(RBAC)을 운영합니다.</li>
        <li>접근 로그는 1년간 보관하며, 월 1회 이상 이상 징후를 점검합니다.</li>
        <li>연 1회 이상 보안 진단과 교육을 실시하고, 결과를 요약해 정기총회에 보고합니다.</li>
      </ul>
    )
  },
  {
    id: 'contact',
    title: '7. 개인정보 보호책임자',
    summary: '문의 및 민원 처리를 위한 책임자 정보를 제공합니다.',
    content: (
      <dl className="space-y-2">
        <div>
          <dt className="font-semibold text-neutral-ink">개인정보 보호책임자</dt>
          <dd className="text-neutral-muted">김서강 회장 (office@sogang-econ-alumni.kr)</dd>
        </div>
        <div>
          <dt className="font-semibold text-neutral-ink">개인정보 보호담당자</dt>
          <dd className="text-neutral-muted">박은영 사무국장 (privacy@sogang-econ-alumni.kr, 02-715-1234)</dd>
        </div>
      </dl>
    )
  }
];

export default function PrivacyPage() {
  return (
    <div className="space-y-12 rounded-3xl bg-white px-6 py-12 shadow-soft md:px-12">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-muted">Policy</p>
        <h1 className="font-heading text-3xl text-neutral-ink md:text-4xl">개인정보 처리방침</h1>
        <p className="text-sm leading-6 text-neutral-muted">
          서강대 경제대학원 총동문회는 『개인정보 보호법』, 『정보통신망 이용촉진 및 정보보호 등에 관한 법률』 등 관련 법령을 준수하며 회원 정보를 보호합니다.
          아래 항목을 확인하시고, 문의 사항은 언제든지 개인정보 보호책임자에게 전달해 주세요.
        </p>
      </header>

      <div className="space-y-10">
        {sections.map((section) => (
          <section key={section.id} aria-labelledby={`${section.id}-title`} className="space-y-4 rounded-2xl border border-neutral-border bg-white/70 p-6 shadow-sm">
            <div className="space-y-2">
              <h2 id={`${section.id}-title`} className="font-heading text-xl text-brand-primary">
                {section.title}
              </h2>
              <p className="text-sm text-neutral-muted">{section.summary}</p>
            </div>
            <div className="space-y-3 text-sm leading-6 text-neutral-muted">{section.content}</div>
          </section>
        ))}
      </div>

      <footer className="rounded-2xl bg-brand-surface px-6 py-6 text-xs uppercase tracking-widest text-neutral-muted md:py-8">
        <p>문서 버전: 2025-10-08 · 시행일: 2025-10-15</p>
        <p className="mt-2 text-neutral-muted/80">시행일: 2025-10-15 · 개정일: 2025-10-08</p>
      </footer>
    </div>
  );
}
