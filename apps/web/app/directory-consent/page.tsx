"use client";

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { LockSimple, ShieldCheck, UserCircle, UsersThree } from '@phosphor-icons/react';

import { AuthGuard } from '../../components/auth-guard';
import { AuthHeading, AuthPage } from '../../components/auth-page';
import { SignupJourney } from '../../components/signup-journey';
import { Button } from '../../components/ui/button';
import { useToast } from '../../components/toast';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../lib/api';
import { DIRECTORY_DISCLOSURE_ITEMS, VISIBILITY_INFO } from '../../lib/member-experience';
import { memberApiErrorToMessage } from '../../lib/error-map';
import { submitDirectoryConsent } from '../../services/me';
import type { ProfileVisibility } from '../me/validation';

const OPTIONS: Array<{
  value: ProfileVisibility;
  icon: typeof UsersThree;
  recommended?: boolean;
}> = [
  { value: 'all', icon: UsersThree, recommended: true },
  { value: 'cohort', icon: UserCircle },
  { value: 'private', icon: LockSimple },
];

function DirectoryConsentForm() {
  const router = useRouter();
  const toast = useToast();
  const { invalidate } = useAuth();
  const [visibility, setVisibility] = useState<ProfileVisibility>('all');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsAgreement = visibility !== 'private';

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (needsAgreement && !agreed) {
      setError('공개하려면 아래 안내에 동의해 주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await submitDirectoryConsent(visibility);
      await invalidate();
      const message = visibility === 'private'
        ? '동문 수첩 상세는 잠근 채로 시작합니다. 나중에 내 정보에서 바꿀 수 있어요.'
        : '동문 수첩 공개 설정을 저장했습니다.';
      toast.show(message, { type: 'success' });
      router.replace('/' as Route);
    } catch (caught: unknown) {
      setError(
        caught instanceof ApiError
          ? memberApiErrorToMessage(caught.code, caught.message)
          : '공개 설정을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthPage>
      <SignupJourney currentStep={4} />
      <AuthHeading
        eyebrow="동문 수첩"
        title="동문 수첩에 정보를 공개할까요?"
        description="비밀번호 만들기와 별도로, 다른 동문에게 연락처를 보여주기 전에 한 번 확인합니다. 거부해도 가입과 로그인은 그대로 이용할 수 있어요."
      />
      <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-neutral-border bg-white p-5 md:p-7">
        <section className="space-y-3 text-sm leading-6 text-text-secondary">
          <h2 className="font-semibold text-text-primary">공개 전에 확인하세요</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>제공받는 사람: 로그인한 동문. 같은 기수만 고르면 해당 기수 동문에게만 보입니다.</li>
            <li>이용 목적: 동문 친목과 연락</li>
            <li>보유 기간: 공개를 철회하거나 탈퇴할 때까지</li>
            <li>거부 시: 계정은 유지되고 동문 수첩 상세만 잠깁니다.</li>
          </ul>
          <p className="font-medium text-text-primary">공개되는 항목</p>
          <ul className="list-disc space-y-1 pl-5">
            {DIRECTORY_DISCLOSURE_ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p>
            입력하지 않은 항목은 나가지 않습니다. 나중에 내 정보에서 공개 범위를 바꾸거나 철회할 수 있어요.{' '}
            <Link href="/privacy" className="font-medium text-brand-800 underline">
              개인정보 처리방침
            </Link>
          </p>
        </section>

        <fieldset className="space-y-3">
          <legend className="font-semibold text-text-primary">공개 범위</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {OPTIONS.map(({ value, icon: Icon, recommended }) => {
              const selected = visibility === value;
              return (
                <label
                  key={value}
                  className={`flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border px-3 py-3 text-center text-sm transition-colors focus-within:ring-2 focus-within:ring-brand-400 ${
                    selected
                      ? 'border-brand-400 bg-brand-50 text-brand-800'
                      : 'border-neutral-border text-text-secondary hover:bg-surface-raised'
                  }`}
                >
                  <input
                    type="radio"
                    name="directory-consent-visibility"
                    value={value}
                    checked={selected}
                    onChange={() => {
                      setVisibility(value);
                      if (value === 'private') setAgreed(false);
                    }}
                    className="sr-only"
                  />
                  <Icon size={24} weight={selected ? 'fill' : 'regular'} aria-hidden="true" />
                  <span className="font-semibold">
                    {value === 'all' ? '모든 동문' : value === 'cohort' ? '같은 기수' : '잠가 두기'}
                    {recommended ? <span className="block text-xs font-medium">추천</span> : null}
                  </span>
                </label>
              );
            })}
          </div>
          <p className="flex items-start gap-2 text-sm leading-5 text-text-muted">
            <ShieldCheck className="mt-0.5 shrink-0" size={20} aria-hidden="true" />
            <span>{VISIBILITY_INFO[visibility].description}</span>
          </p>
        </fieldset>

        {needsAgreement ? (
          <label className="flex items-start gap-3 rounded-xl bg-surface-sunken p-4 text-sm leading-6 text-text-primary">
            <input
              id="directory-disclosure-agree"
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              className="mt-1 size-4 shrink-0"
            />
            <span>
              위 내용을 확인했고, 선택한 범위의 동문에게 내 수첩 정보를 공개하는 데 동의합니다.
            </span>
          </label>
        ) : null}

        {error ? <p role="alert" className="text-sm text-state-error">{error}</p> : null}

        <Button loading={busy} size="lg" className="w-full">
          {busy ? '저장 중...' : visibility === 'private' ? '공개하지 않고 시작하기' : '동의하고 저장하기'}
        </Button>
      </form>
    </AuthPage>
  );
}

export default function DirectoryConsentPage() {
  return (
    <AuthGuard>
      <DirectoryConsentForm />
    </AuthGuard>
  );
}
