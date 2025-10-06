"use client";

import { useMutation } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import { Suspense, useState } from 'react';
import { login } from '../../services/auth';
import { useToast } from '../../components/toast';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

export default function LoginPage() {
  return (
    <Suspense fallback={<section className="mx-auto max-w-sm"><p>로그인 폼을 불러오는 중…</p></section>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { show } = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';
  const { invalidate } = useAuth();

  const mutate = useMutation({
    mutationFn: () => login({ email, password }),
    onSuccess: async () => {
      await invalidate();
      show('로그인되었습니다.', { type: 'success' });
      const dest = typeof next === 'string' && next.startsWith('/') ? (next as Route) : ('/' as Route);
      router.replace(dest);
    },
    onError: (e: unknown) => {
      const msg = e instanceof ApiError ? '로그인 실패' : '알 수 없는 오류';
      show(msg, { type: 'error' });
    }
  });

  return (
    <section className="mx-auto max-w-sm space-y-4">
      <h2 className="text-xl font-semibold">관리자 로그인</h2>
      <label className="block text-sm">
        이메일
        <input className="mt-1 w-full rounded border px-2 py-1" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
      </label>
      <label className="block text-sm">
        비밀번호
        <input
          className="mt-1 w-full rounded border px-2 py-1"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
        />
      </label>
      <button
        className="rounded bg-slate-900 px-3 py-1 text-white disabled:opacity-50"
        disabled={mutate.isPending || !email || !password}
        onClick={() => mutate.mutate()}
      >
        로그인
      </button>
    </section>
  );
}
