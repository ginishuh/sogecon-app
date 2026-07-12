"use client";

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useToast } from '../../components/toast';
import { SignupJourney } from '../../components/signup-journey';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../lib/api';
import { memberApiErrorToMessage } from '../../lib/error-map';
import { MEMBER_LANGUAGE } from '../../lib/member-language';
import { isPasswordWithinBcryptLimit, PASSWORD_TOO_LONG_MESSAGE } from '../../lib/password';
import { activate } from '../../services/member';

type Feedback = {
  tone: 'success' | 'error';
  message: string;
  recovery?: 'login' | 'contact';
};

function activationErrorFeedback(error: unknown): Feedback {
  if (!(error instanceof ApiError)) {
    return {
      tone: 'error',
      message: '첫 로그인 설정을 완료하지 못했습니다. 안내받은 링크를 다시 확인해 주세요.',
      recovery: 'contact',
    };
  }
  const identity = `${error.code ?? ''} ${error.message}`;
  if (identity.includes('activation_already_used')) {
    return {
      tone: 'error',
      message: '이미 비밀번호 만들기를 마친 안내입니다. 기존 비밀번호로 로그인해 주세요.',
      recovery: 'login',
    };
  }
  if (identity.includes('invalid_or_expired_activation_token')) {
    return {
      tone: 'error',
      message: '안내 링크가 올바르지 않거나 사용 기한이 지났습니다. 동문회 사무국에 새 안내를 요청해 주세요.',
      recovery: 'contact',
    };
  }
  return {
    tone: 'error',
    message: memberApiErrorToMessage(error.code, error.message),
    recovery: 'contact',
  };
}

function RecoveryActions({ recovery }: { recovery?: Feedback['recovery'] }) {
  if (recovery === 'login') {
    return <Link href="/login" className="text-sm font-medium text-brand-700 underline">로그인하기</Link>;
  }
  if (recovery === 'contact') {
    return <Link href="/support/contact" className="text-sm font-medium text-brand-700 underline">동문회 사무국에 문의하기</Link>;
  }
  return null;
}

function FeedbackBanner({ feedback }: { feedback: Feedback | null }) {
  if (feedback == null) return null;

  const className =
    feedback.tone === 'success'
      ? 'border-state-success-ring bg-state-success-subtle text-state-success'
      : 'border-state-error-ring bg-state-error-subtle text-state-error';

  return (
    <div
      id="activation-feedback"
      className={`space-y-2 rounded border px-3 py-2 text-sm ${className}`}
      role={feedback.tone === 'error' ? 'alert' : 'status'}
    >
      <p>{feedback.message}</p>
      <RecoveryActions recovery={feedback.recovery} />
    </div>
  );
}

export default function ActivatePage() {
  return (
    <Suspense fallback={<div className="max-w-xl p-6 text-sm text-text-secondary">첫 로그인 설정 화면을 준비 중입니다…</div>}>
      <ActivateForm />
    </Suspense>
  );
}

function CompletedPanel() {
  return (
    <div className="mx-auto max-w-2xl space-y-5 p-6">
      <SignupJourney currentStep={4} />
      <h1 className="text-2xl font-semibold">첫 로그인 완료</h1>
      <section className="space-y-4 rounded-xl border border-state-success-ring bg-state-success-subtle p-5">
        <p role="status" className="font-medium text-state-success">첫 로그인 설정을 마치고 로그인했습니다.</p>
        <p className="text-sm text-text-secondary">이제 동문 수첩과 게시판 등 동문 전용 메뉴를 이용할 수 있습니다.</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/me" className="rounded bg-brand-700 px-4 py-2 text-sm text-white">내 정보 확인하기</Link>
          <Link href="/" className="rounded border border-brand-700 px-4 py-2 text-sm text-brand-700">홈으로 이동</Link>
        </div>
      </section>
    </div>
  );
}

type ActivationSetupProps = {
  busy: boolean;
  feedback: Feedback | null;
  hasLinkedToken: boolean;
  manualEntry: boolean;
  password: string;
  status: string;
  token: string;
  codeInputRef: React.RefObject<HTMLInputElement | null>;
  onManualEntry: () => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onTokenChange: (value: string) => void;
};

function LinkPrompt({ onManualEntry }: { onManualEntry: () => void }) {
  return (
    <section className="space-y-4 rounded-xl border border-neutral-border bg-white p-5">
      <h2 className="font-semibold text-text-primary">안내 링크를 받으셨나요?</h2>
      <p className="text-sm text-text-secondary">받은 메시지의 링크를 다시 열어 주세요. 링크를 열면 별도의 코드 입력 없이 비밀번호를 만들 수 있습니다.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={onManualEntry} className="rounded border border-brand-700 px-4 py-2 text-sm text-brand-700">
          코드 직접 입력하기
        </button>
        <Link href="/support/contact" className="px-2 py-2 text-sm text-brand-700 underline">안내를 받지 못했어요</Link>
      </div>
    </section>
  );
}

function ActivationInputForm(props: ActivationSetupProps) {
  const hasError = props.feedback?.tone === 'error';
  return (
    <form onSubmit={props.onSubmit} className="flex flex-col gap-3 rounded-xl border border-neutral-border bg-white p-5">
      <FeedbackBanner feedback={props.feedback} />
      {!props.hasLinkedToken ? (
        <label className="text-sm">
          {MEMBER_LANGUAGE.activationCode}
          <input
            ref={props.codeInputRef}
            required
            aria-invalid={hasError}
            aria-describedby={hasError ? 'activation-feedback' : undefined}
            className="mt-1 w-full rounded border px-3 py-2"
            value={props.token}
            onChange={(event) => props.onTokenChange(event.target.value)}
            placeholder="안내받은 코드를 입력해 주세요"
          />
        </label>
      ) : (
        <p className="rounded-lg bg-brand-50 p-3 text-sm text-brand-900">안내 링크에서 코드를 불러왔습니다.</p>
      )}
      <label className="text-sm">
        새 비밀번호
        <input
          required
          minLength={8}
          autoComplete="new-password"
          type="password"
          aria-invalid={hasError}
          aria-describedby={hasError ? 'activation-feedback' : undefined}
          className="mt-1 w-full rounded border px-3 py-2"
          value={props.password}
          onChange={(event) => props.onPasswordChange(event.target.value)}
        />
      </label>
      <button disabled={props.busy} className="rounded bg-state-success px-4 py-2 text-white disabled:opacity-50">
        {props.busy ? '설정 중...' : '비밀번호 만들기 완료'}
      </button>
    </form>
  );
}

function ActivationSetup(props: ActivationSetupProps) {
  const showForm = props.hasLinkedToken || props.manualEntry;
  const description = props.hasLinkedToken
    ? '안내 링크의 코드가 적용되었습니다. 앞으로 사용할 비밀번호를 만들어 주세요.'
    : '가입 확인이 끝나면 동문회 사무국에서 비밀번호 만들기 링크를 보내드립니다.';

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-6">
      <SignupJourney currentStep={3} />
      <h1 className="text-2xl font-semibold">비밀번호 만들기</h1>
      <p className="text-sm text-text-secondary">{description}</p>
      {showForm ? <ActivationInputForm {...props} /> : <LinkPrompt onManualEntry={props.onManualEntry} />}
      {props.status === 'authorized' ? <p className="text-sm text-state-success">로그인 상태입니다.</p> : null}
      <Link href="/login" className="text-xs text-brand-700 underline">로그인 페이지로 이동</Link>
    </div>
  );
}

function ActivateForm() {
  const { status, invalidate } = useAuth();
  const toast = useToast();
  const params = useSearchParams();
  const linkedToken = params.get('token') ?? '';
  const [token, setToken] = useState(linkedToken);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [manualEntry, setManualEntry] = useState(false);
  const [completed, setCompleted] = useState(false);
  const codeInputRef = useRef<HTMLInputElement | null>(null);
  const hasLinkedToken = linkedToken.length > 0;

  useEffect(() => {
    if (!hasLinkedToken) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('token');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, [hasLinkedToken]);

  useEffect(() => {
    if (manualEntry) codeInputRef.current?.focus();
  }, [manualEntry]);

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
      setCompleted(true);
      setFeedback({ tone: 'success', message });
      toast.show(message, { type: 'success' });
    } catch (error: unknown) {
      const nextFeedback = activationErrorFeedback(error);
      setFeedback(nextFeedback);
      toast.show(nextFeedback.message, { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (completed) return <CompletedPanel />;
  return (
    <ActivationSetup
      busy={busy}
      codeInputRef={codeInputRef}
      feedback={feedback}
      hasLinkedToken={hasLinkedToken}
      manualEntry={manualEntry}
      password={password}
      status={status}
      token={token}
      onManualEntry={() => setManualEntry(true)}
      onPasswordChange={setPassword}
      onSubmit={onSubmit}
      onTokenChange={setToken}
    />
  );
}
