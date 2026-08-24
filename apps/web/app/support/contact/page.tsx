"use client";

import { useRef, useState } from 'react';
import { useToast } from '../../../components/toast';
import { ApiError } from '../../../lib/api';
import { officeMailto, siteConfig } from '../../../lib/site';
import { submitContact } from '../../../services/support';

type ContactField = 'subject' | 'body' | 'email';
type ContactErrors = Partial<Record<ContactField | 'form', string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateContact(subject: string, body: string, email: string): ContactErrors {
  const errors: ContactErrors = {};
  if (!subject) errors.subject = '문의 제목을 입력해 주세요.';
  else if (subject.length < 3) errors.subject = '문의 제목은 3자 이상 입력해 주세요.';
  if (!body) errors.body = '문의 내용을 입력해 주세요.';
  else if (body.length < 10) errors.body = '문의 내용은 10자 이상 입력해 주세요.';
  if (!email) errors.email = '답변받을 이메일을 입력해 주세요.';
  else if (!EMAIL_PATTERN.test(email)) {
    errors.email = '이메일 형식을 확인해 주세요. 예: name@example.com';
  }
  return errors;
}

function submitErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 422) return '입력한 내용을 다시 확인해 주세요.';
    if (error.status === 429) return '문의가 연속으로 접수되었습니다. 1분 후 다시 보내 주세요.';
    if (error.status >= 500) return '현재 문의를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.';
  }
  return '문의를 보내지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.';
}

function FieldHint({ id, error, hint }: { id: string; error?: string; hint: string }) {
  return (
    <p
      id={id}
      role={error ? 'alert' : undefined}
      className={`text-xs ${error ? 'text-state-error' : 'text-text-secondary'}`}
    >
      {error ?? hint}
    </p>
  );
}

export default function SupportContactPage() {
  const toast = useToast();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<ContactErrors>({});
  const [busy, setBusy] = useState(false);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const clearFieldError = (field: ContactField) => {
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = {
      subject: subject.trim(),
      body: body.trim(),
      email: email.trim(),
    };
    const validation = validateContact(normalized.subject, normalized.body, normalized.email);
    setErrors(validation);
    const firstInvalid = (['subject', 'body', 'email'] as const).find((field) => validation[field]);
    if (firstInvalid) {
      const fieldRefs = { subject: subjectRef, body: bodyRef, email: emailRef };
      fieldRefs[firstInvalid].current?.focus();
      return;
    }

    setBusy(true);
    try {
      await submitContact({
        subject: normalized.subject,
        body: normalized.body,
        contact: normalized.email,
      });
      toast.show('문의가 접수되었습니다.', { type: 'success' });
      setSubject(''); setBody(''); setEmail('');
      setErrors({});
    } catch (error) {
      const message = submitErrorMessage(error);
      setErrors({ form: message });
      toast.show(message, { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 max-w-xl">
      <h2 className="mb-1 text-xl font-semibold">동문회 사무국 문의</h2>
      <p className="mb-4 text-sm text-text-secondary">
        홈페이지 이용이나 동문회 활동에 관해 궁금한 점을 남겨 주세요. 메일로 바로 보내시려면{' '}
        <a className="text-link inline-flex min-h-11 items-center" href={officeMailto}>{siteConfig.officeEmail}</a>
        으로 연락해 주세요.
      </p>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-3">
        {errors.form && <p role="alert" className="rounded bg-state-error-subtle p-3 text-sm text-state-error">{errors.form}</p>}
        <label className="text-sm">제목
          <input
            ref={subjectRef}
            className="mt-1 w-full rounded border px-3 py-2"
            required
            minLength={3}
            maxLength={120}
            aria-describedby="support-subject-hint"
            aria-invalid={Boolean(errors.subject)}
            value={subject}
            onChange={(e) => { setSubject(e.target.value); clearFieldError('subject'); }}
          />
        </label>
        <FieldHint id="support-subject-hint" error={errors.subject} hint="3자 이상 입력해 주세요." />
        <label className="text-sm">내용
          <textarea
            ref={bodyRef}
            className="mt-1 w-full rounded border px-3 py-2"
            required
            minLength={10}
            maxLength={10000}
            aria-describedby="support-body-hint"
            aria-invalid={Boolean(errors.body)}
            rows={5}
            value={body}
            onChange={(e) => { setBody(e.target.value); clearFieldError('body'); }}
          />
        </label>
        <FieldHint id="support-body-hint" error={errors.body} hint="10자 이상 입력해 주세요." />
        <label className="text-sm">답변받을 이메일
          <input
            ref={emailRef}
            className="mt-1 w-full rounded border px-3 py-2"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            aria-describedby="support-email-hint"
            aria-invalid={Boolean(errors.email)}
            value={email}
            onChange={(e) => { setEmail(e.target.value); clearFieldError('email'); }}
            placeholder="name@example.com"
          />
        </label>
        <FieldHint
          id="support-email-hint"
          error={errors.email}
          hint="답변받을 수 있는 이메일을 입력해 주세요."
        />
        <button disabled={busy} className="rounded bg-state-success px-4 py-2 text-white disabled:opacity-50">보내기</button>
      </form>
    </div>
  );
}
