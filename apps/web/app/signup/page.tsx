"use client";

import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { AuthHeading, AuthPage, AuthSectionHeading } from '../../components/auth-page';
import { useToast } from '../../components/toast';
import { SignupJourney } from '../../components/signup-journey';
import { Button } from '../../components/ui/button';
import { ButtonLink } from '../../components/ui/button-link';
import { Input } from '../../components/ui/input';
import { TextArea } from '../../components/ui/textarea';
import { ApiError } from '../../lib/api';
import { memberApiErrorToMessage } from '../../lib/error-map';
import { MEMBER_LANGUAGE } from '../../lib/member-language';
import {
  createSignupRequest,
  type SignupRequestCreatePayload,
  type SignupRequestRead,
} from '../../services/signup-requests';

type Feedback = {
  tone: 'success' | 'error';
  message: string;
};

function parseCohort(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function FeedbackBanner({
  feedback,
  elementRef,
}: {
  feedback: Feedback | null;
  elementRef?: RefObject<HTMLParagraphElement | null>;
}) {
  if (feedback == null) return null;

  const className =
    feedback.tone === 'success'
      ? 'border-state-success-ring bg-state-success-subtle text-state-success'
      : 'border-state-error-ring bg-state-error-subtle text-state-error';

  return (
    <p
      ref={elementRef}
      className={`rounded border px-3 py-2 text-sm ${className}`}
      role={feedback.tone === 'error' ? 'alert' : 'status'}
      tabIndex={feedback.tone === 'error' ? -1 : undefined}
    >
      {feedback.message}
    </p>
  );
}

export default function SignupPage() {
  const { show } = useToast();
  const [submitted, setSubmitted] = useState<SignupRequestRead | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ cohort?: string; phone?: string }>({});
  const cohortRef = useRef<HTMLInputElement | null>(null);
  const phoneRef = useRef<HTMLInputElement | null>(null);
  const feedbackRef = useRef<HTMLParagraphElement | null>(null);
  const [form, setForm] = useState({
    studentId: '',
    email: '',
    name: '',
    cohort: '',
    major: '',
    phone: '',
    note: '',
  });

  const mutate = useMutation({
    mutationFn: (payload: SignupRequestCreatePayload) => createSignupRequest(payload),
    onSuccess: (data) => {
      const message = '가입신청이 접수되었습니다.';
      setSubmitted(data);
      setFeedback({ tone: 'success', message });
      show(message, { type: 'success' });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof ApiError
          ? memberApiErrorToMessage(error.code, error.message)
          : '가입 신청을 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.';
      setFeedback({ tone: 'error', message });
    },
  });

  useEffect(() => {
    if (feedback?.tone !== 'error') return;
    const banner = feedbackRef.current;
    if (banner == null) return;
    banner.focus({ preventScroll: true });
    banner.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [feedback]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cohort = parseCohort(form.cohort);
    const phone = form.phone.trim();
    if (cohort == null) {
      const message = '기수를 숫자로 입력해 주세요.';
      setFeedback(null);
      setFieldErrors((previous) => ({ ...previous, cohort: message }));
      cohortRef.current?.focus();
      return;
    }
    if (!phone) {
      const message = '연락처를 입력해 주세요.';
      setFeedback(null);
      setFieldErrors((previous) => ({ ...previous, phone: message }));
      phoneRef.current?.focus();
      return;
    }

    setFieldErrors({});
    setFeedback(null);
    mutate.mutate({
      student_id: form.studentId.trim(),
      email: form.email.trim(),
      name: form.name.trim(),
      cohort,
      major: form.major.trim() || null,
      phone,
      note: form.note.trim() || null,
    });
  };

  if (submitted != null) {
    const isPending = submitted.status === 'pending';
    return (
      <AuthPage>
        <SignupJourney currentStep={2} />
        <div className="space-y-5 rounded-2xl border border-neutral-border bg-white p-5 md:p-7">
        <AuthHeading
          eyebrow="가입 신청 접수"
          title="가입 신청 완료"
          description="보내주신 정보를 동문회 사무국에서 확인하고 있습니다."
        />
        {isPending ? (
          <p className="text-sm text-text-secondary">
            현재 <b className="text-text-primary">동문회 사무국 확인 중</b>입니다. 확인이 끝나면
            등록한 연락처로 비밀번호를 만드는 안내 링크를 보내드립니다.
          </p>
        ) : (
          <p className="text-sm text-text-secondary">
            신청은 접수되었지만 현재 상태를 화면에서 안내하기 어렵습니다. 동문회 사무국에 문의해 주세요.
          </p>
        )}
        <FeedbackBanner feedback={feedback} />
        <dl className="grid gap-2 rounded border border-neutral-border bg-surface-raised p-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-text-muted">신청번호</dt>
            <dd className="font-medium text-text-primary">#{submitted.id}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-text-muted">학번</dt>
            <dd className="font-medium text-text-primary">{submitted.student_id}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-text-muted">상태</dt>
            <dd className="font-medium text-state-info">{isPending ? '사무국 확인 중' : '상태 확인 필요'}</dd>
          </div>
        </dl>
        {isPending ? (
          <p className="rounded-lg bg-brand-50 p-3 text-sm text-brand-900">
            안내를 받기 전에는 로그인하거나 비밀번호를 만들 수 없습니다. 별도로 다시 신청하지 말고
            안내를 기다려 주세요.
          </p>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <ButtonLink href="/" className="flex-1">
            홈으로 이동
          </ButtonLink>
          <ButtonLink
            href="/support/contact"
            variant="secondary"
            className="flex-1"
          >
            확인이 오래 걸리면 문의하기
          </ButtonLink>
        </div>
        </div>
      </AuthPage>
    );
  }

  return (
    <AuthPage>
      <SignupJourney currentStep={1} />
      <AuthHeading
        eyebrow="동문 인증"
        title={MEMBER_LANGUAGE.signup}
        description={`기본 정보를 보내주시면 ${MEMBER_LANGUAGE.officeName}에서 확인한 뒤 첫 로그인 방법을 안내해 드립니다.`}
      />

      <form
        onSubmit={onSubmit}
        className="space-y-6 bg-white md:rounded-2xl md:border md:border-neutral-border md:p-8"
      >
        <FeedbackBanner feedback={feedback} elementRef={feedbackRef} />
        <section className="space-y-4" aria-labelledby="signup-identity-heading">
          <div id="signup-identity-heading"><AuthSectionHeading>동문 확인 정보</AuthSectionHeading></div>
          <div className="grid gap-5 md:grid-cols-2">
          <Input
            id="signup-student-id"
            label="학번"
            layout="inline"
            required
            inputMode="numeric"
            autoComplete="username"
            value={form.studentId}
            onChange={(e) => {
              const value = e.currentTarget.value;
              setForm((prev) => ({ ...prev, studentId: value }));
            }}
          />
          <Input
            id="signup-name"
            label="이름"
            layout="inline"
            required
            autoComplete="name"
            value={form.name}
            onChange={(e) => {
              const value = e.currentTarget.value;
              setForm((prev) => ({ ...prev, name: value }));
            }}
          />
          <Input
            ref={cohortRef}
            id="signup-cohort"
            label="기수"
            layout="inline"
            required
            inputMode="numeric"
            errorText={fieldErrors.cohort}
            value={form.cohort}
            onChange={(e) => {
              const value = e.currentTarget.value;
              setForm((prev) => ({ ...prev, cohort: value }));
              setFieldErrors((previous) => ({ ...previous, cohort: undefined }));
            }}
          />
          <Input
            id="signup-major"
            label="전공(선택)"
            layout="inline"
            value={form.major}
            onChange={(e) => {
              const value = e.currentTarget.value;
              setForm((prev) => ({ ...prev, major: value }));
            }}
          />
          </div>
        </section>

        <section className="space-y-4" aria-labelledby="signup-contact-heading">
          <div id="signup-contact-heading"><AuthSectionHeading>연락받을 정보</AuthSectionHeading></div>
          <div className="grid gap-5 md:grid-cols-2">
          <Input
            id="signup-email"
            label="이메일"
            layout="inline"
            required
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => {
              const value = e.currentTarget.value;
              setForm((prev) => ({ ...prev, email: value }));
            }}
          />
          <Input
            ref={phoneRef}
            id="signup-phone"
            label="연락처"
            layout="inline"
            required
            inputMode="tel"
            autoComplete="tel"
            errorText={fieldErrors.phone}
            value={form.phone}
            onChange={(e) => {
              const value = e.currentTarget.value;
              setForm((prev) => ({ ...prev, phone: value }));
              setFieldErrors((previous) => ({ ...previous, phone: undefined }));
            }}
          />
          </div>
          <details className="rounded-lg border border-neutral-border bg-surface-raised px-3">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-text-primary">
              사무국에 전할 내용이 있나요? (선택)
            </summary>
            <div className="pb-3 pt-1">
              <TextArea
                id="signup-note"
                label="사무국에 전할 내용(선택)"
                rows={3}
                helperText="가입 확인에 참고할 내용이 있을 때만 입력해 주세요."
                value={form.note}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setForm((prev) => ({ ...prev, note: value }));
                }}
              />
            </div>
          </details>
        </section>

        <p className="text-sm text-text-muted"><span className="font-semibold text-state-error">*</span> 필수 항목을 모두 입력해 주세요.</p>
        <div className="flex flex-col gap-3 pt-1">
          <Button
            type="submit"
            size="lg"
            loading={mutate.isPending}
            className="w-full"
          >
            {mutate.isPending ? '보내는 중...' : '가입 정보 보내기'}
          </Button>
          <ButtonLink
            href="/login"
            variant="ghost"
            className="w-full"
          >
            이미 가입했어요
          </ButtonLink>
        </div>
      </form>
    </AuthPage>
  );
}
