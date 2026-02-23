"use client";

import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { useToast } from '../../components/toast';
import { ApiError } from '../../lib/api';
import { apiErrorToMessage } from '../../lib/error-map';
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

export default function SignupPage() {
  const { show } = useToast();
  const [submitted, setSubmitted] = useState<SignupRequestRead | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
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
          ? apiErrorToMessage(error.code, error.message)
          : '가입신청 처리 중 오류가 발생했습니다.';
      setFeedback({ tone: 'error', message });
      show(message, { type: 'error' });
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cohort = parseCohort(form.cohort);
    if (cohort == null) {
      const message = '기수를 숫자로 입력해 주세요.';
      setFeedback({ tone: 'error', message });
      show(message, { type: 'error' });
      return;
    }

    setFeedback(null);
    mutate.mutate({
      student_id: form.studentId.trim(),
      email: form.email.trim(),
      name: form.name.trim(),
      cohort,
      major: form.major.trim() || null,
      phone: form.phone.trim() || null,
      note: form.note.trim() || null,
    });
  };

  if (submitted != null) {
    return (
      <section className="mx-auto max-w-2xl space-y-5 rounded-xl border border-neutral-border bg-white p-6">
        <h1 className="text-2xl font-semibold text-text-primary">가입신청 완료</h1>
        <p className="text-sm text-text-secondary">
          심사 상태가 <b className="text-text-primary">대기 중</b>으로 접수되었습니다.
          승인 후 전달받은 활성화 토큰으로 비밀번호 설정을 진행해 주세요.
        </p>
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
            <dd className="font-medium text-state-info">승인 대기</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/login"
            className="rounded bg-brand-700 px-4 py-2 text-sm text-white hover:bg-brand-800 hover:text-white"
          >
            로그인으로 이동
          </Link>
          <Link
            href="/activate"
            className="rounded border border-brand-700 px-4 py-2 text-sm text-brand-700 hover:bg-brand-50"
          >
            계정 활성화
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-text-primary">신규 가입신청</h1>
        <p className="text-sm text-text-secondary">
          기본 정보를 제출하면 관리자 심사 후 계정 활성화 토큰을 안내드립니다.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="grid gap-4 rounded-xl border border-neutral-border bg-white p-6"
      >
        <FeedbackBanner feedback={feedback} />

        <label className="text-sm text-text-primary">
          학번
          <input
            required
            className="mt-1 w-full rounded border border-neutral-border px-3 py-2"
            value={form.studentId}
            onChange={(e) => {
              const value = e.currentTarget.value;
              setForm((prev) => ({ ...prev, studentId: value }));
            }}
          />
        </label>

        <label className="text-sm text-text-primary">
          이름
          <input
            required
            className="mt-1 w-full rounded border border-neutral-border px-3 py-2"
            value={form.name}
            onChange={(e) => {
              const value = e.currentTarget.value;
              setForm((prev) => ({ ...prev, name: value }));
            }}
          />
        </label>

        <label className="text-sm text-text-primary">
          이메일
          <input
            required
            type="email"
            className="mt-1 w-full rounded border border-neutral-border px-3 py-2"
            value={form.email}
            onChange={(e) => {
              const value = e.currentTarget.value;
              setForm((prev) => ({ ...prev, email: value }));
            }}
          />
        </label>

        <label className="text-sm text-text-primary">
          기수
          <input
            required
            inputMode="numeric"
            className="mt-1 w-full rounded border border-neutral-border px-3 py-2"
            value={form.cohort}
            onChange={(e) => {
              const value = e.currentTarget.value;
              setForm((prev) => ({ ...prev, cohort: value }));
            }}
          />
        </label>

        <label className="text-sm text-text-primary">
          전공(선택)
          <input
            className="mt-1 w-full rounded border border-neutral-border px-3 py-2"
            value={form.major}
            onChange={(e) => {
              const value = e.currentTarget.value;
              setForm((prev) => ({ ...prev, major: value }));
            }}
          />
        </label>

        <label className="text-sm text-text-primary">
          연락처(선택)
          <input
            className="mt-1 w-full rounded border border-neutral-border px-3 py-2"
            value={form.phone}
            onChange={(e) => {
              const value = e.currentTarget.value;
              setForm((prev) => ({ ...prev, phone: value }));
            }}
          />
        </label>

        <label className="text-sm text-text-primary">
          메모(선택)
          <textarea
            rows={4}
            className="mt-1 w-full rounded border border-neutral-border px-3 py-2"
            value={form.note}
            onChange={(e) => {
              const value = e.currentTarget.value;
              setForm((prev) => ({ ...prev, note: value }));
            }}
          />
        </label>

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="submit"
            disabled={mutate.isPending}
            className="rounded bg-brand-700 px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {mutate.isPending ? '제출 중...' : '가입신청 제출'}
          </button>
          <Link
            href="/login"
            className="rounded border border-neutral-border px-4 py-2 text-sm text-text-secondary hover:bg-surface-raised"
          >
            로그인으로 돌아가기
          </Link>
        </div>
      </form>
    </section>
  );
}
