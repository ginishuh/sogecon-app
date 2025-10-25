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
      const msg = e instanceof ApiError ? '로그인 실패' : '알 수 없는 오류';
      show(msg, { type: 'error' });
    }
  });

  return (
    <section className="mx-auto max-w-sm space-y-4">
      <p className="text-xs text-slate-500">로그인 후 권한에 따라 접근 가능한 메뉴가 달라집니다.</p>
      <label className="block text-sm">
        학번
        <input className="mt-1 w-full rounded border px-2 py-1" value={studentId} onChange={(e) => setStudentId(e.currentTarget.value)} />
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
        disabled={mutate.isPending || !studentId || !password}
        onClick={() => mutate.mutate()}
      >로그인</button>
    </section>
  );
}
