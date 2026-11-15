"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AuthHeading, AuthPage } from '../../components/auth-page';
import { useToast } from '../../components/toast';
import { Button } from '../../components/ui/button';
import { ButtonLink } from '../../components/ui/button-link';
import { Input } from '../../components/ui/input';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../lib/api';
import { memberApiErrorToMessage } from '../../lib/error-map';
import { isPasswordWithinBcryptLimit, PASSWORD_TOO_LONG_MESSAGE } from '../../lib/password';
import { confirmPasswordReset } from '../../services/member';

type ResetError = { message: string; retry: boolean };

function resetErrorFeedback(error: unknown): ResetError {
  if (error instanceof ApiError) {
    if (error.code === 'invalid_or_expired_reset_token') {
      return { message: memberApiErrorToMessage(error.code, error.message), retry: true };
    }
    if (error.status === 429) {
      return { message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.', retry: false };
    }
    return { message: memberApiErrorToMessage(error.code, error.message), retry: false };
  }
  return { message: '비밀번호를 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.', retry: false };
}

// 재설정 토큰은 URL fragment(#token=)로만 받는다. fragment는 HTTP 요청에 실리지 않아
// 서버·프록시 접근 로그와 Referer에 남지 않는다. 읽은 즉시 주소창·방문 기록에서도 지운다.
function takeTokenFromFragment(): string {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';
  if (window.location.hash) {
    const { pathname, search } = window.location;
    window.history.replaceState(window.history.state, '', `${pathname}${search}`);
  }
  return token;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const toast = useToast();
  const { invalidate } = useAuth();
  // null: 아직 fragment를 읽기 전(서버 렌더링·hydration 직후)
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ResetError | null>(null);

  // StrictMode 개발 모드는 effect를 두 번 실행한다. 첫 실행이 fragment를 지우므로
  // 처음 읽은 값을 ref에 보관해 두 번째 실행에서도 같은 토큰을 쓴다.
  const takenToken = useRef<string | null>(null);
  useEffect(() => {
    takenToken.current ??= takeTokenFromFragment();
    setToken(takenToken.current);
  }, []);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirm) {
      setError({ message: '새 비밀번호와 확인 값이 서로 다릅니다.', retry: false });
      return;
    }
    if (!isPasswordWithinBcryptLimit(password)) {
      setError({ message: PASSWORD_TOO_LONG_MESSAGE, retry: false });
      return;
    }
    setBusy(true);
    setError(null);
    if (!token) return;
    try {
      await confirmPasswordReset({ token, password });
      await invalidate();
      toast.show('비밀번호를 바꿨습니다. 새 비밀번호로 로그인해 주세요.', { type: 'success' });
      router.replace('/login');
    } catch (err: unknown) {
      setError(resetErrorFeedback(err));
    } finally {
      setBusy(false);
    }
  };

  if (token === null) {
    return <div className="max-w-xl p-6 text-sm text-text-secondary">비밀번호 재설정 화면을 준비 중입니다…</div>;
  }

  if (!token) {
    return (
      <AuthPage width="narrow">
        <AuthHeading eyebrow="비밀번호 찾기" title="새 비밀번호 만들기" description="메일로 받은 재설정 링크를 열어 주세요." />
        <section className="space-y-3 rounded-2xl border border-neutral-border bg-white p-5 text-sm text-text-secondary md:p-7">
          <p>재설정 링크가 없거나 이미 사용한 링크입니다. 비밀번호 찾기를 다시 요청해 주세요.</p>
          <ButtonLink href="/forgot-password" variant="secondary">비밀번호 찾기</ButtonLink>
        </section>
      </AuthPage>
    );
  }

  const describedBy = error ? 'reset-password-error' : undefined;
  return (
    <AuthPage width="narrow">
      <AuthHeading eyebrow="비밀번호 찾기" title="새 비밀번호 만들기" description="앞으로 로그인에 사용할 새 비밀번호를 입력해 주세요." />
      <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-neutral-border bg-white p-5 md:p-7">
        {error ? (
          <div id="reset-password-error" role="alert" className="space-y-2 rounded-lg border border-state-error-ring bg-state-error-subtle p-3 text-sm text-state-error">
            <p>{error.message}</p>
            {error.retry ? (
              <Link href="/forgot-password" className="inline-flex min-h-11 items-center font-medium underline">재설정 링크 다시 받기</Link>
            ) : null}
          </div>
        ) : null}
        <Input
          id="reset-password"
          label="새 비밀번호"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          helperText="8자 이상, UTF-8 기준 72바이트 이하로 만들어 주세요."
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          value={password}
          onChange={(event) => setPassword(event.currentTarget.value)}
        />
        <Input
          id="reset-password-confirm"
          label="새 비밀번호 확인"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          value={confirm}
          onChange={(event) => setConfirm(event.currentTarget.value)}
        />
        <Button loading={busy} size="lg" className="w-full">
          {busy ? '변경 중...' : '새 비밀번호 저장'}
        </Button>
      </form>
    </AuthPage>
  );
}
