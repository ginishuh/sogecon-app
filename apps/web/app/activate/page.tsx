"use client";

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useToast } from '../../components/toast';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../lib/api';
import { memberApiErrorToMessage } from '../../lib/error-map';
import { MEMBER_LANGUAGE } from '../../lib/member-language';
import { isPasswordWithinBcryptLimit, PASSWORD_TOO_LONG_MESSAGE } from '../../lib/password';
import { activate } from '../../services/member';

type Feedback = {
  tone: 'success' | 'error';
  message: string;
};

function FeedbackBanner({ feedback }: { feedback: Feedback | null }) {
  if (feedback == null) return null;

  const className =
    feedback.tone === 'success'
      ? 'border-state-success-ring bg-state-success-subtle text-state-success'
      : 'border-state-error-ring bg-state-error-subtle text-state-error';

  return (
    <p className={`rounded border px-3 py-2 text-sm ${className}`} role="status">
      {feedback.message}
    </p>
  );
}

export default function ActivatePage() {
  return (
    <Suspense fallback={<div className="max-w-xl p-6 text-sm text-text-secondary">첫 로그인 설정 화면을 준비 중입니다…</div>}>
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
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordWithinBcryptLimit(password)) {
      setFeedback({ tone: 'error', message: PASSWORD_TOO_LONG_MESSAGE });
      toast.show(PASSWORD_TOO_LONG_MESSAGE, { type: 'error' });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      await activate({ token, password });
      await invalidate();
      const message = '첫 로그인 설정을 마치고 로그인했습니다.';
      setFeedback({ tone: 'success', message });
      toast.show(message, { type: 'success' });
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? memberApiErrorToMessage(error.code, error.message)
          : '첫 로그인 설정을 완료하지 못했습니다. 안내받은 코드와 비밀번호를 확인해 주세요.';
      setFeedback({ tone: 'error', message });
      toast.show(message, { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl p-6">
      <h2 className="mb-2 text-xl font-semibold">{MEMBER_LANGUAGE.activation}</h2>
      <p className="mb-4 text-sm text-text-secondary">
        가입 승인 안내와 함께 받은 코드를 입력하고 앞으로 사용할 비밀번호를 설정해 주세요.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <FeedbackBanner feedback={feedback} />
        <label className="text-sm">
          {MEMBER_LANGUAGE.activationCode}
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="안내받은 코드를 입력해 주세요"
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
          {busy ? '설정 중...' : '첫 로그인 설정 완료'}
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
