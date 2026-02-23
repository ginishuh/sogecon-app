"use client";

import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import { Suspense, useState } from 'react';
import { login } from '../../services/auth';
import { useToast } from '../../components/toast';
import { ApiError } from '../../lib/api';
import { apiErrorToMessage } from '../../lib/error-map';
import { useAuth } from '../../hooks/useAuth';

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
  // 통합 로그인으로 전환하여 모드 상태 제거
  const { show } = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';
  const { invalidate } = useAuth();

  const mutate = useMutation({
    mutationFn: () => login({ student_id: studentId, password }),
    onSuccess: async () => {
      await invalidate();
      show('로그인되었습니다.', { type: 'success' });
      const dest = typeof next === 'string' && next.startsWith('/') ? (next as Route) : ('/' as Route);
      router.replace(dest);
    },
    onError: (e: unknown) => {
      const msg = e instanceof ApiError ? apiErrorToMessage(e.code, e.message) : '알 수 없는 오류';
      show(msg, { type: 'error' });
    }
  });

  return (
    <section className="mx-auto max-w-sm space-y-4">
      <p className="text-xs text-text-muted">로그인 후 권한에 따라 접근 가능한 메뉴가 달라집니다.</p>
      <label className="block text-sm text-text-primary">
        학번
        <input className="mt-1 w-full rounded border border-neutral-border bg-surface px-2 py-1 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-400" value={studentId} onChange={(e) => setStudentId(e.currentTarget.value)} />
      </label>
      <label className="block text-sm text-text-primary">
        비밀번호
        <input
          className="mt-1 w-full rounded border border-neutral-border bg-surface px-2 py-1 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-400"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
        />
      </label>
      <button
        className="rounded bg-brand-700 px-3 py-1 text-text-inverse hover:bg-brand-800 disabled:opacity-50"
        disabled={mutate.isPending || !studentId || !password}
        onClick={() => mutate.mutate()}
      >로그인</button>
      <div className="flex flex-wrap gap-3 text-xs">
        <Link href="/signup" className="text-brand-700 underline">
          신규 가입신청
        </Link>
        <Link href="/activate" className="text-text-secondary underline">
          승인 후 계정 활성화
        </Link>
      </div>
    </section>
  );
}
