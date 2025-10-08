import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: '이용약관',
  description:
    '서강대 경제대학원 총원우회 웹 서비스 이용과 관련된 회원의 권리, 의무 및 책임사항을 규정합니다. 서비스를 이용하기 전에 약관을 확인해 주세요.'
};

type TermsSection = {
  id: string;
  title: string;
  clauses: React.ReactNode;
};

const sections: TermsSection[] = [
  {
    id: 'purpose',
    title: '제1조 (목적)',
    clauses: (
      <p>
        본 약관은 서강대학교 경제대학원 총원우회(이하 &quot;총원우회&quot;)가 제공하는 웹 서비스(이하 &quot;서비스&quot;)의 이용과 관련하여 총원우회와 회원 간의 권리, 의무 및
        책임 사항을 규정함을 목적으로 합니다.
      </p>
    )
  },
  {
    id: 'definitions',
    title: '제2조 (용어의 정의)',
    clauses: (
      <ul className="list-disc space-y-2 pl-5">
        <li>&quot;회원&quot;이라 함은 본 약관에 동의하고 서비스를 이용하는 서강대 경제대학원 총원우회 구성원을 말합니다.</li>
        <li>
          &quot;ID&quot;는 회원 식별과 서비스 이용을 위해 회원이 부여받은 학번을 의미합니다.
        </li>
        <li>&quot;비밀번호&quot;는 회원의 개인정보 보호와 인증을 위하여 회원 본인이 설정한 문자와 숫자의 조합을 말합니다.</li>
        <li>&quot;콘텐츠&quot;는 총원우회가 서비스 상에 게시하거나 회원이 업로드하는 모든 자료를 의미합니다.</li>
      </ul>
    )
  },
  {
    id: 'membership',
    title: '제3조 (회원 가입 및 자격)',
    clauses: (
      <ol className="list-decimal space-y-2 pl-5">
        <li>회원 가입은 총원우회 정회원으로 등록된 경우에 한하여 사용할 수 있습니다.</li>
        <li>회원은 최초 로그인 후 비밀번호를 변경해야 하며, 정보를 최신 상태로 유지할 의무가 있습니다.</li>
        <li>타인의 정보를 도용하거나 허위 정보를 입력한 경우, 서비스 이용이 제한될 수 있습니다.</li>
      </ol>
    )
  },
  {
    id: 'obligations',
    title: '제4조 (회원의 의무)',
    clauses: (
      <ol className="list-decimal space-y-2 pl-5">
        <li>회원은 본 약관과 관련 법령, 총원우회가 정한 서비스 이용 안내를 준수해야 합니다.</li>
        <li>회원은 자신의 계정 정보를 제3자에게 공유하거나 대여할 수 없습니다.</li>
        <li>회원은 서비스 이용 중 습득한 다른 회원의 개인정보를 본래 목적 외로 사용하거나 제3자에게 제공할 수 없습니다.</li>
        <li>게시물 작성 시 저작권을 침해하지 않으며, 허위 사실 또는 명예를 훼손하는 내용을 게시할 수 없습니다.</li>
      </ol>
    )
  },
  {
    id: 'services',
    title: '제5조 (서비스의 제공 및 변경)',
    clauses: (
      <>
        <p>
          총원우회는 다음과 같은 서비스를 제공합니다.
        </p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>공지, 행사, 디렉터리, 소개 등 총원우회 관련 정보 제공</li>
          <li>회원 간 교류를 위한 커뮤니티, 알림 서비스</li>
          <li>총원우회 운영과 관련한 각종 신청 및 통계 기능</li>
        </ul>
        <p className="mt-3">
          총원우회는 필요한 경우 서비스의 내용을 변경하거나 중단할 수 있으며, 변경 사항은 사전에 회원에게 공지합니다.
        </p>
      </>
    )
  },
  {
    id: 'suspension',
    title: '제6조 (서비스의 중단)',
    clauses: (
      <ul className="list-disc space-y-2 pl-5">
        <li>시스템 점검, 교체, 고장 등 부득이한 사유가 발생한 경우 서비스 제공이 일시 중단될 수 있습니다.</li>
        <li>천재지변, 정전, 통신 장애 등 불가항력적 사유로 인한 서비스 중단 시 총원우회는 지체 없이 회원에게 공지합니다.</li>
      </ul>
    )
  },
  {
    id: 'intellectual-property',
    title: '제7조 (저작권의 귀속 및 이용 제한)',
    clauses: (
      <ol className="list-decimal space-y-2 pl-5">
        <li>서비스와 관련된 저작권 및 지식재산권은 총원우회에 귀속합니다.</li>
        <li>
          회원이 서비스 내에 게시한 콘텐츠의 저작권은 회원에게 있으며, 총원우회는 서비스 운영을 위해 비독점적으로 이를 이용할 수 있습니다.
        </li>
        <li>회원은 서비스 이용으로 얻은 정보를 총원우회의 사전 승인 없이 복제, 전송, 배포, 출판, 방송 등 기타 방법으로 이용하거나 제3자에게 제공할 수 없습니다.</li>
      </ol>
    )
  },
  {
    id: 'termination',
    title: '제8조 (이용계약 해지 및 제한)',
    clauses: (
      <ol className="list-decimal space-y-2 pl-5">
        <li>회원은 언제든지 마이페이지에서 회원 탈퇴를 신청할 수 있으며, 총원우회는 관련 법령이 정한 범위 내에서 개인정보를 보유/파기합니다.</li>
        <li>회원이 약관을 위반하거나 아래 행위를 하는 경우 총원우회는 사전 통지 후 서비스 이용을 제한하거나 해지할 수 있습니다.
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>타인의 정보를 도용하거나 부정하게 사용하는 행위</li>
            <li>서비스 운영을 고의로 방해하는 행위</li>
            <li>법령 또는 공공질서에 위반되는 콘텐츠 게시</li>
          </ul>
        </li>
      </ol>
    )
  },
  {
    id: 'liability',
    title: '제9조 (면책 조항)',
    clauses: (
      <ul className="list-disc space-y-2 pl-5">
        <li>총원우회는 천재지변, 전쟁, 기간통신사업자의 서비스 중단 등 불가항력으로 인한 손해에 대해서는 책임을 부담하지 않습니다.</li>
        <li>회원의 귀책사유로 인한 서비스 이용 장애에 대해서는 총원우회가 책임을 지지 않습니다.</li>
        <li>회원이 서비스 내에서 제공한 정보 및 자료의 정확성에 대해 총원우회는 보증하지 않습니다.</li>
      </ul>
    )
  },
  {
    id: 'jurisdiction',
    title: '제10조 (준거법 및 관할)',
    clauses: (
      <p>
        본 약관과 관련하여 분쟁이 발생한 경우 대한민국 법을 준거법으로 하며, 분쟁으로 소송이 제기될 경우 민사소송법상의 관할 법원을 따릅니다.
      </p>
    )
  },
  {
    id: 'appendix',
    title: '부칙',
    clauses: (
      <ul className="list-disc space-y-2 pl-5">
        <li>본 약관은 2025년 10월 15일부터 시행됩니다.</li>
        <li>총원우회는 필요 시 약관을 개정할 수 있으며, 개정 시 최소 7일 전에 공지합니다.</li>
      </ul>
    )
  }
];

export default function TermsPage() {
  return (
    <div className="space-y-12 rounded-3xl bg-white px-6 py-12 shadow-soft md:px-12">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-muted">Policy</p>
        <h1 className="font-heading text-3xl text-neutral-ink md:text-4xl">이용약관</h1>
        <p className="text-sm leading-6 text-neutral-muted">
          서비스 이용 전에 아래 약관을 확인해 주세요. 총원우회는 회원에게 공정하고 안전한 서비스를 제공하기 위해 약관을 투명하게 운영합니다.
        </p>
      </header>

      <div className="space-y-10">
        {sections.map((section) => (
          <section key={section.id} aria-labelledby={`${section.id}-title`} className="space-y-4 rounded-2xl border border-neutral-border bg-white/70 p-6 shadow-sm">
            <h2 id={`${section.id}-title`} className="font-heading text-xl text-brand-primary">
              {section.title}
            </h2>
            <div className="space-y-3 text-sm leading-6 text-neutral-muted">{section.clauses}</div>
          </section>
        ))}
      </div>

      <footer className="rounded-2xl bg-brand-surface px-6 py-6 text-xs uppercase tracking-widest text-neutral-muted md:py-8">
        문서 버전: 2025-10-08 · 시행일: 2025-10-15
      </footer>
    </div>
  );
}
