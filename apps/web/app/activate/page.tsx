"use client";

import { useState } from 'react';
import { useToast } from '../../components/toast';
import { useAuth } from '../../hooks/useAuth';
import { activate } from '../../services/member';

export default function ActivatePage() {
  const { status, invalidate } = useAuth();
  const toast = useToast();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await activate({ token, password });
      await invalidate();
      toast.show('활성화 및 로그인 완료', { type: 'success' });
    } catch {
      toast.show('활성화에 실패했습니다. 토큰/비밀번호를 확인하세요.', { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 max-w-xl">
      <h2 className="mb-4 text-xl font-semibold">멤버 활성화</h2>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="text-sm">토큰
          <input className="mt-1 w-full rounded border px-3 py-2" value={token} onChange={(e) => setToken(e.target.value)} placeholder="서명된 활성화 토큰" />
        </label>
        <label className="text-sm">비밀번호
          <input type="password" className="mt-1 w-full rounded border px-3 py-2" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button disabled={busy} className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-50">활성화</button>
      </form>
      {status === 'authorized' ? (
        <p className="mt-3 text-sm text-emerald-700">로그인 상태입니다.</p>
      ) : null}
    </div>
  );
}
