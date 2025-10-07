"use client";

import { useMutation } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import { Suspense, useState } from 'react';
import { login, memberLogin } from '../../services/auth';
import { useToast } from '../../components/toast';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useEffect } from 'react';

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
  const [mode, setMode] = useState<'member'|'admin'>('member');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('loginMode');
      if (saved === 'admin' || saved === 'member') setMode(saved);
    } catch {}
  }, []);

  const setModePersist = (m: 'member'|'admin') => {
    setMode(m);
    try { localStorage.setItem('loginMode', m); } catch {}
  };
  const { show } = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';
  const { invalidate } = useAuth();

  const mutate = useMutation({
    mutationFn: () => (mode === 'admin' ? login({ email, password }) : memberLogin({ email, password })),
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
      <div className="flex items-center gap-2 text-sm">
        <button
          className={`rounded px-3 py-1 ${mode==='member'?'bg-slate-900 text-white':'border'}`}
          onClick={() => setModePersist('member')}
        >멤버 로그인</button>
        <button
          className={`rounded px-3 py-1 ${mode==='admin'?'bg-slate-900 text-white':'border'}`}
          onClick={() => setModePersist('admin')}
        >관리자 로그인</button>
      </div>
      <p className="text-xs text-slate-500">
        멤버 로그인: 구독/알림 등 일반 기능 이용. 관리자 로그인: 생성/관리 기능 접근.
      </p>
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
        {mode==='admin'?'관리자':'멤버'} 로그인
      </button>
    </section>
  );
}
