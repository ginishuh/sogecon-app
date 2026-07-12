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
      show(msg, { type: 'error' });
    }
  });

  return (
    <section className="mx-auto max-w-lg space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-text-primary">동문 로그인</h1>
        <p className="text-sm text-text-secondary">이미 비밀번호를 만든 동문은 학번과 비밀번호로 로그인해 주세요.</p>
      </header>
      <form
        className="space-y-4 rounded-xl border border-neutral-border bg-white p-5"
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
      <label className="block text-sm text-text-primary">
        학번
        <input aria-invalid={Boolean(loginError)} aria-describedby={loginError ? 'login-error' : undefined} className="mt-1 w-full rounded border border-neutral-border bg-surface px-2 py-1 text-text-primary focus:outline-hidden focus:ring-2 focus:ring-brand-400" value={studentId} onChange={(e) => setStudentId(e.currentTarget.value)} />
      </label>
      <label className="block text-sm text-text-primary">
        비밀번호
        <input
          className="mt-1 w-full rounded border border-neutral-border bg-surface px-2 py-1 text-text-primary focus:outline-hidden focus:ring-2 focus:ring-brand-400"
          type="password"
          aria-invalid={Boolean(loginError)}
          aria-describedby={loginError ? 'login-error' : undefined}
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
        />
      </label>
      <button
        type="submit"
        className="rounded bg-brand-700 px-3 py-1 text-text-inverse hover:bg-brand-800 disabled:opacity-50"
        disabled={mutate.isPending || !studentId || !password}
      >로그인</button>
      </form>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/signup" className="rounded-xl border border-neutral-border bg-white p-4 no-underline hover:border-brand-400 hover:no-underline">
          <strong className="block text-sm text-text-primary">처음 방문했어요</strong>
          <span className="mt-1 block text-xs text-text-secondary">{MEMBER_LANGUAGE.signup}부터 시작합니다.</span>
        </Link>
        <Link href="/activate" className="rounded-xl border border-neutral-border bg-white p-4 no-underline hover:border-brand-400 hover:no-underline">
          <strong className="block text-sm text-text-primary">가입 승인 안내를 받았어요</strong>
          <span className="mt-1 block text-xs text-text-secondary">안내 링크에서 비밀번호를 만듭니다.</span>
        </Link>
      </div>
      <p className="text-center text-xs text-text-muted">가입 신청 후 확인 중이라면 별도로 다시 신청하지 않아도 됩니다.</p>
    </section>
  );
}
