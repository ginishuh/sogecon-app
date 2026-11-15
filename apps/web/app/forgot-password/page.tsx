"use client";

import Link from 'next/link';
import { useState } from 'react';
import { AuthHeading, AuthPage } from '../../components/auth-page';
import { Button } from '../../components/ui/button';
import { ButtonLink } from '../../components/ui/button-link';
import { Input } from '../../components/ui/input';
import { ApiError } from '../../lib/api';
import { OFFICE_CONTACT_MESSAGE } from '../../lib/member-language';
import { requestPasswordReset } from '../../services/member';

function requestErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
    }
    if (error.code === 'email_not_configured') {
      return `지금은 재설정 메일을 보낼 수 없습니다. ${OFFICE_CONTACT_MESSAGE}`;
    }
  }
  return '요청을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

export default function ForgotPasswordPage() {
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset({ student_id: studentId.trim(), email: email.trim() });
      setSent(true);
    } catch (err: unknown) {
      setError(requestErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthPage width="narrow">
      <AuthHeading
        eyebrow="비밀번호 찾기"
        title="비밀번호 재설정"
        description="학번과 회원 정보에 등록된 이메일을 입력하시면 새 비밀번호를 만들 수 있는 링크를 보내드립니다."
      />
      {sent ? (
        <section role="status" className="space-y-3 rounded-2xl border border-neutral-border bg-white p-5 text-sm text-text-secondary md:p-7">
          <h2 className="text-base font-semibold text-text-primary">메일을 확인해 주세요</h2>
          <p>입력하신 학번과 이메일이 회원 정보와 일치하면 재설정 링크를 보냈습니다. 링크는 1시간 동안 한 번만 사용할 수 있습니다.</p>
          <p>몇 분이 지나도 메일이 없다면 스팸함을 확인하거나 입력한 정보를 다시 확인해 주세요.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="secondary" onClick={() => setSent(false)}>다시 요청하기</Button>
            <ButtonLink href="/login" variant="ghost">로그인으로 돌아가기</ButtonLink>
          </div>
        </section>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-neutral-border bg-white p-5 md:p-7">
          {error ? (
            <div id="forgot-password-error" role="alert" className="rounded-lg border border-state-error-ring bg-state-error-subtle p-3 text-sm text-state-error">
              {error}
            </div>
          ) : null}
          <Input
            id="forgot-student-id"
            label="학번"
            required
            autoComplete="username"
            autoCapitalize="none"
            aria-describedby={error ? 'forgot-password-error' : undefined}
            value={studentId}
            onChange={(event) => setStudentId(event.currentTarget.value)}
          />
          <Input
            id="forgot-email"
            label="이메일"
            type="email"
            required
            autoComplete="email"
            aria-describedby={error ? 'forgot-password-error' : undefined}
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
          />
          <Button loading={busy} size="lg" className="w-full" disabled={busy || !studentId.trim() || !email.trim()}>
            {busy ? '요청 중...' : '재설정 링크 받기'}
          </Button>
        </form>
      )}
      <div className="space-y-2 text-center text-sm text-text-muted">
        <p>등록된 이메일이 없거나 바뀌었다면 사무국에서 도와드립니다.</p>
        <Link href="/support/contact" className="inline-flex min-h-11 items-center px-2 font-medium text-brand-700 underline">
          동문회 사무국에 문의하기
        </Link>
      </div>
    </AuthPage>
  );
}
