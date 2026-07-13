"use client";

import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import { Suspense, useState } from 'react';
import { login } from '../../services/auth';
import { useToast } from '../../components/toast';
import { ApiError } from '../../lib/api';
import { memberApiErrorToMessage } from '../../lib/error-map';
import { useAuth } from '../../hooks/useAuth';
import { MEMBER_LANGUAGE } from '../../lib/member-language';
import { AuthHeading, AuthPage } from '../../components/auth-page';
import { Button } from '../../components/ui/button';
import { ButtonLink } from '../../components/ui/button-link';
import { Input } from '../../components/ui/input';

export default function LoginPage() {
  return (
    <Suspense fallback={<section className="mx-auto max-w-sm"><p>로그인 폼을 불러오는 중…</p></section>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<{ message: string; code?: string } | null>(null);
  // 통합 로그인으로 전환하여 모드 상태 제거
  const { show } = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';
  const { invalidate } = useAuth();

  const mutate = useMutation({
    mutationFn: () => login({ student_id: studentId, password }),
    onSuccess: async () => {
      setLoginError(null);
      await invalidate();
      show('로그인되었습니다.', { type: 'success' });
      const dest = typeof next === 'string' && next.startsWith('/') ? (next as Route) : ('/' as Route);
      router.replace(dest);
    },
    onError: (e: unknown) => {
      const msg = e instanceof ApiError
        ? memberApiErrorToMessage(e.code, e.message)
        : '로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.';
      setLoginError({ message: msg, code: e instanceof ApiError ? e.code : undefined });
    }
  });

  return (
    <AuthPage width="narrow">
      <AuthHeading
        eyebrow="동문 인증"
        title="동문 로그인"
        description="이미 비밀번호를 만든 동문은 학번과 비밀번호로 로그인해 주세요."
      />
      <form
        className="space-y-5 rounded-2xl border border-neutral-border bg-white p-5 md:p-7"
        onSubmit={(event) => {
          event.preventDefault();
          mutate.mutate();
        }}
      >
      {loginError ? (
        <div id="login-error" role="alert" className="space-y-2 rounded-lg border border-state-error-ring bg-state-error-subtle p-3 text-sm text-state-error">
          <p>{loginError.message}</p>
          {loginError.code === 'member_pending_approval' ? (
            <Link href="/support/contact" className="font-medium underline">확인이 오래 걸리면 사무국에 문의하기</Link>
          ) : null}
        </div>
      ) : null}
      <Input
        id="login-student-id"
        label="학번"
        autoComplete="username"
        inputMode="numeric"
        aria-invalid={Boolean(loginError)}
        aria-describedby={loginError ? 'login-error' : undefined}
        value={studentId}
        onChange={(event) => setStudentId(event.currentTarget.value)}
      />
      <Input
          id="login-password"
          label="비밀번호"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(loginError)}
          aria-describedby={loginError ? 'login-error' : undefined}
          value={password}
          onChange={(event) => setPassword(event.currentTarget.value)}
      />
      <Button
        type="submit"
        size="lg"
        loading={mutate.isPending}
        className="w-full"
        disabled={mutate.isPending || !studentId || !password}
      >로그인</Button>
      </form>
      <nav aria-label="다른 인증 방법" className="grid gap-3 sm:grid-cols-2">
        <ButtonLink href="/signup" variant="secondary" className="min-h-20 flex-col items-start px-4 py-3 text-left">
          <strong className="block text-sm text-text-primary">처음 방문했어요</strong>
          <span className="mt-1 block text-xs font-normal text-text-secondary">{MEMBER_LANGUAGE.signup}부터 시작합니다.</span>
        </ButtonLink>
        <ButtonLink href="/activate" variant="secondary" className="min-h-20 flex-col items-start px-4 py-3 text-left">
          <strong className="block text-sm text-text-primary">가입 승인 안내를 받았어요</strong>
          <span className="mt-1 block text-xs font-normal text-text-secondary">안내 링크에서 비밀번호를 만듭니다.</span>
        </ButtonLink>
      </nav>
      <div className="space-y-2 text-center text-sm text-text-muted">
        <p>가입 신청 후 확인 중이라면 별도로 다시 신청하지 않아도 됩니다.</p>
        <Link href="/support/contact" className="inline-flex min-h-11 items-center px-2 font-medium text-brand-700 underline">
          비밀번호를 잊었거나 로그인이 어려우신가요?
        </Link>
      </div>
    </AuthPage>
  );
}
