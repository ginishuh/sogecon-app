"use client";

import { useState } from 'react';
import { useToast } from '../../../components/toast';
import { useAuth } from '../../../hooks/useAuth';
import { changePassword } from '../../../services/member';

export default function ChangePasswordPage() {
  const { status } = useAuth();
  const toast = useToast();
  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await changePassword({ current_password: cur, new_password: nw });
      toast.show('비밀번호가 변경되었습니다.', { type: 'success' });
      setCur(''); setNw('');
    } catch {
      toast.show('비밀번호 변경에 실패했습니다.', { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 max-w-xl">
      <h2 className="mb-4 text-xl font-semibold">비밀번호 변경</h2>
      {status !== 'authorized' ? (
        <p className="mb-3 text-sm text-slate-600">로그인 후 이용하세요.</p>
      ) : null}
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="text-sm">현재 비밀번호
          <input type="password" className="mt-1 w-full rounded border px-3 py-2" value={cur} onChange={(e) => setCur(e.target.value)} />
        </label>
        <label className="text-sm">새 비밀번호
          <input type="password" className="mt-1 w-full rounded border px-3 py-2" value={nw} onChange={(e) => setNw(e.target.value)} />
        </label>
        <button disabled={busy} className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-50">변경</button>
      </form>
    </div>
  );
}

