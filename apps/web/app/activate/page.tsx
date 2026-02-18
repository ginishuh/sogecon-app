"use client";

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useToast } from '../../components/toast';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../lib/api';
import { apiErrorToMessage } from '../../lib/error-map';
import { activate } from '../../services/member';

export default function ActivatePage() {
  return (
    <Suspense fallback={<div className="max-w-xl p-6 text-sm text-text-secondary">활성화 화면을 준비 중입니다…</div>}>
      <ActivateForm />
    </Suspense>
  );
}

function ActivateForm() {
  const { status, invalidate } = useAuth();
  const toast = useToast();
  const params = useSearchParams();
  const [token, setToken] = useState(() => params.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await activate({ token, password });
      await invalidate();
      toast.show('활성화 및 로그인 완료', { type: 'success' });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        toast.show(apiErrorToMessage(error.code, error.message), { type: 'error' });
      } else {
        toast.show('활성화에 실패했습니다. 토큰/비밀번호를 확인하세요.', { type: 'error' });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl p-6">
      <h2 className="mb-2 text-xl font-semibold">멤버 활성화</h2>
      <p className="mb-4 text-sm text-text-secondary">
        관리자 승인 후 전달받은 활성화 토큰으로 비밀번호를 설정해 로그인 상태를 생성합니다.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="text-sm">
          토큰
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="서명된 활성화 토큰"
          />
        </label>
        <label className="text-sm">
          비밀번호
          <input
            type="password"
            className="mt-1 w-full rounded border px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button
          disabled={busy}
          className="rounded bg-state-success px-4 py-2 text-white disabled:opacity-50"
        >
          {busy ? '활성화 중...' : '활성화'}
        </button>
      </form>
      {status === 'authorized' ? (
        <p className="mt-3 text-sm text-state-success">로그인 상태입니다.</p>
      ) : null}
      <div className="mt-4 text-xs">
        <Link href="/login" className="text-brand-700 underline">
          로그인 페이지로 이동
        </Link>
      </div>
    </div>
  );
}
