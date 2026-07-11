"use client";

import { useState } from 'react';
import { useToast } from '../../../components/toast';
import { useAuth } from '../../../hooks/useAuth';
import { isPasswordWithinBcryptLimit, PASSWORD_TOO_LONG_MESSAGE } from '../../../lib/password';
import { changePassword } from '../../../services/member';

export default function ChangePasswordPage() {
  const { status } = useAuth();
  const toast = useToast();
  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordWithinBcryptLimit(nw)) {
      setFeedback({ tone: 'error', message: PASSWORD_TOO_LONG_MESSAGE });
      toast.show(PASSWORD_TOO_LONG_MESSAGE, { type: 'error' });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      await changePassword({ current_password: cur, new_password: nw });
      const message = '비밀번호가 변경되었습니다.';
      setFeedback({ tone: 'success', message });
      toast.show(message, { type: 'success' });
      setCur(''); setNw('');
    } catch {
      const message = '비밀번호 변경에 실패했습니다.';
      setFeedback({ tone: 'error', message });
      toast.show(message, { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 max-w-xl">
      <h2 className="mb-4 text-xl font-semibold">비밀번호 변경</h2>
      {status !== 'authorized' ? (
        <p className="mb-3 text-sm text-text-secondary">로그인 후 이용하세요.</p>
      ) : null}
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        {feedback ? (
          <p
            className={feedback.tone === 'success' ? 'text-sm text-state-success' : 'text-sm text-state-error'}
            role="status"
          >
            {feedback.message}
          </p>
        ) : null}
        <label className="text-sm">현재 비밀번호
          <input type="password" className="mt-1 w-full rounded border px-3 py-2" value={cur} onChange={(e) => setCur(e.target.value)} />
        </label>
        <label className="text-sm">새 비밀번호
          <input type="password" className="mt-1 w-full rounded border px-3 py-2" value={nw} onChange={(e) => setNw(e.target.value)} />
        </label>
        <button disabled={busy} className="rounded bg-state-success px-4 py-2 text-white disabled:opacity-50">변경</button>
      </form>
    </div>
  );
}
