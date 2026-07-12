"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../lib/api';
import { memberApiErrorToMessage } from '../../lib/error-map';
import { useToast } from '../../components/toast';
import {
  buildProfilePayload,
  ProfileErrors,
  ProfileForm,
  ProfileVisibility,
  validateProfileForm,
} from './validation';
import { getMe, updateMe, updateAvatar, type MemberDto, API_BASE } from '../../services/me';
import { ChangeRequestSection } from './change-request';
import Button from '../../components/ui/button';
import { VISIBILITY_INFO } from '../../lib/member-experience';

const asDisplayString = (value: string | null | undefined): string => value ?? '';

const toFormState = (member: MemberDto): ProfileForm => ({
  email: asDisplayString(member.email),
  major: asDisplayString(member.major),
  visibility: member.visibility,
  birth_date: asDisplayString(member.birth_date),
  birth_lunar: Boolean(member.birth_lunar),
  phone: asDisplayString(member.phone),
  company: asDisplayString(member.company),
  department: asDisplayString(member.department),
  job_title: asDisplayString(member.job_title),
  company_phone: asDisplayString(member.company_phone),
  addr_personal: asDisplayString(member.addr_personal),
  addr_company: asDisplayString(member.addr_company),
  industry: asDisplayString(member.industry),
});

const inputClass =
  'mt-1 min-h-11 w-full rounded border border-neutral-border px-3 py-2 focus:border-brand-500 focus:outline-hidden focus:ring-2 focus:ring-brand-400';
const textareaClass =
  'mt-1 min-h-11 w-full rounded border border-neutral-border px-3 py-2 focus:border-brand-500 focus:outline-hidden focus:ring-2 focus:ring-brand-400';

const fieldErrorId = (field: keyof ProfileForm) => `profile-${field}-error`;

const MAX_UPLOAD_BYTES = 2_000_000;

type StringField = Exclude<keyof ProfileForm, 'birth_lunar' | 'visibility'>;

type TextFieldProps<K extends StringField> = {
  field: K;
  label: string;
  draft: ProfileForm;
  errors: ProfileErrors;
  onChange: <T extends keyof ProfileForm>(field: T, value: ProfileForm[T]) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
};

function TextField<K extends StringField>({
  field,
  label,
  draft,
  errors,
  onChange,
  placeholder,
  multiline,
  rows = 3,
}: TextFieldProps<K>) {
  const error = errors[field];
  const errorId = error ? fieldErrorId(field) : undefined;
  const inputId = `profile-${field}`;

  return (
    <div className="flex flex-col">
      <label htmlFor={inputId} className="font-medium text-text-primary">{label}</label>
      {multiline ? (
        <textarea
          id={inputId}
          className={textareaClass}
          rows={rows}
          value={draft[field]}
          placeholder={placeholder}
          onChange={(event) =>
            onChange(field, event.target.value as ProfileForm[K])
          }
          aria-invalid={Boolean(error)}
          aria-describedby={errorId}
        />
      ) : (
        <input
          id={inputId}
          className={inputClass}
          value={draft[field]}
          placeholder={placeholder}
          onChange={(event) =>
            onChange(field, event.target.value as ProfileForm[K])
          }
          aria-invalid={Boolean(error)}
          aria-describedby={errorId}
        />
      )}
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-xs text-state-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type CheckboxFieldProps = {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
};

function CheckboxField({ label, checked, onChange }: CheckboxFieldProps) {
  return (
    <label className="inline-flex items-center gap-2 text-sm font-medium text-text-primary">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

type VisibilityFieldProps = {
  value: ProfileVisibility;
  errors: ProfileErrors;
  onChange: (next: ProfileVisibility) => void;
  helpId: string;
};

function VisibilityField({
  value,
  errors,
  onChange,
  helpId,
}: VisibilityFieldProps) {
  const error = errors.visibility;
  const errorId = error ? fieldErrorId('visibility') : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;
  const fieldId = 'profile-visibility';

  return (
    <div className="flex flex-col">
      <label htmlFor={fieldId} className="font-medium text-text-primary">공개 범위</label>
      <select
        id={fieldId}
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value as ProfileVisibility)}
        aria-describedby={describedBy}
      >
        <option value="all">전체 공개</option>
        <option value="cohort">기수 한정 공개</option>
        <option value="private">비공개</option>
      </select>
      <p id={helpId} className="mt-1 text-xs text-text-muted">
        {VISIBILITY_INFO[value].description}
      </p>
      <p className="mt-2 rounded-lg bg-surface-raised p-3 text-sm font-medium text-text-primary" role="status">현재 선택: {VISIBILITY_INFO[value].label}</p>
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-xs text-state-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ProfileSummary({ profile }: { profile: MemberDto }) {
  return (
    <dl className="rounded border border-neutral-border bg-surface-raised p-3 text-xs text-text-muted">
      <div className="flex justify-between">
        <dt className="font-medium text-text-secondary">학번</dt>
        <dd>{profile.student_id}</dd>
      </div>
    </dl>
  );
}

function FormErrorMessage({
  message,
  id,
}: {
  message?: string;
  id: string;
}) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className="rounded border border-state-error-ring bg-state-error-subtle px-3 py-2 text-xs text-state-error"
    >
      {message}
    </p>
  );
}

type AvatarUploaderProps = {
  avatarUrl: string | null;
  uploading: boolean;
  onUpload: (file: File) => Promise<void>;
};

function AvatarUploader({ avatarUrl, uploading, onUpload }: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleButtonClick = () => {
    inputRef.current?.click();
  };

  const handleInputChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const input = event.target;
    const file = input.files && input.files[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    void (async () => {
      try {
        await onUpload(file);
      } finally {
        URL.revokeObjectURL(objectUrl);
        setPreviewUrl(null);
        input.value = '';
      }
    })();
  };

  return (
    <section aria-label="프로필 사진" className="flex items-start gap-4">
      <div className="relative h-20 w-20 overflow-hidden rounded-full border border-neutral-border bg-surface-raised">
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt="선택한 프로필 사진 미리보기"
            fill
            unoptimized
            sizes="80px"
            className="object-cover"
          />
        ) : avatarUrl ? (
          <Image
            src={`${API_BASE}${avatarUrl}`}
            alt="현재 프로필 사진"
            fill
            unoptimized
            sizes="80px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-text-muted">
            사진 없음
          </div>
        )}
        {uploading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs text-state-success">
            업로드 중…
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-1 text-xs text-text-muted">
        <Button type="button" onClick={handleButtonClick} disabled={uploading} variant="secondary" size="sm" className="w-fit">
          {uploading ? '업로드 중…' : '이미지 선택'}
        </Button>
        <p>최대 512px · 2MB · JPG/PNG/WEBP</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleInputChange}
        />
      </div>
    </section>
  );
}

type ProfileFormSectionProps = {
  draft: ProfileForm;
  profile: MemberDto;
  errors: ProfileErrors;
  busy: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onChange: <K extends keyof ProfileForm>(field: K, value: ProfileForm[K]) => void;
  visibilityHelpId: string;
  formErrorId: string;
  isDirty: boolean;
  savedMessage: string | null;
};

function ProfileFormSection({
  draft,
  profile,
  errors,
  busy,
  onSubmit,
  onChange,
  visibilityHelpId,
  formErrorId,
  isDirty,
  savedMessage,
}: ProfileFormSectionProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 text-sm"
      aria-describedby={errors.form ? formErrorId : undefined}
    >
      <ProfileSummary profile={profile} />
      <FormErrorMessage message={errors.form} id={formErrorId} />
      {savedMessage ? <p role="status" className="rounded-lg bg-state-success-subtle px-3 py-2 text-sm text-state-success">{savedMessage}</p> : null}
      <TextField field="email" label="이메일" draft={draft} errors={errors} onChange={onChange} />
      <TextField field="major" label="전공(선택)" draft={draft} errors={errors} onChange={onChange} />
      <VisibilityField
        value={draft.visibility}
        errors={errors}
        onChange={(next) => onChange('visibility', next)}
        helpId={visibilityHelpId}
      />
      <TextField
        field="birth_date"
        label="생일(선택)"
        draft={draft}
        errors={errors}
        onChange={onChange}
        placeholder="YYYY-MM-DD"
      />
      <CheckboxField
        label="음력 여부"
        checked={draft.birth_lunar}
        onChange={(next) => onChange('birth_lunar', next)}
      />
      <TextField
        field="phone"
        label="휴대전화(선택)"
        draft={draft}
        errors={errors}
        onChange={onChange}
        placeholder="010-1234-5678"
      />
      <TextField field="company" label="회사명(선택)" draft={draft} errors={errors} onChange={onChange} />
      <TextField
        field="department"
        label="부서(선택)"
        draft={draft}
        errors={errors}
        onChange={onChange}
      />
      <TextField
        field="job_title"
        label="직함(선택)"
        draft={draft}
        errors={errors}
        onChange={onChange}
      />
      <TextField
        field="company_phone"
        label="회사 연락처(선택)"
        draft={draft}
        errors={errors}
        onChange={onChange}
        placeholder="02-1234-5678"
      />
      <TextField
        field="addr_personal"
        label="개인 주소(선택)"
        draft={draft}
        errors={errors}
        onChange={onChange}
        multiline
      />
      <TextField
        field="addr_company"
        label="회사 주소(선택)"
        draft={draft}
        errors={errors}
        onChange={onChange}
        multiline
      />
      <TextField field="industry" label="업종(선택)" draft={draft} errors={errors} onChange={onChange} />
      <Button type="submit" disabled={!isDirty} loading={busy} size="lg">{busy ? '저장 중…' : isDirty ? '변경사항 저장하기' : '저장된 상태입니다'}</Button>
      <Link href="/support/contact" className="text-link inline-flex min-h-11 items-center justify-center text-sm">내 정보 수정이 어려우신가요? 사무국에 문의하기</Link>
    </form>
  );
}

export default function MePage() {
  const { status, invalidate: retryAuth } = useAuth();
  const toast = useToast();
  const [me, setMe] = useState<MemberDto | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [busy, setBusy] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (status !== 'authorized') {
      setMe(null);
      setForm(null);
      setErrors({});
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      try {
        const data = await getMe();
        if (cancelled) return;
        setMe(data);
        setForm(toFormState(data));
        setErrors({});
      } catch {
        if (cancelled) return;
        setMe(null);
        setForm(null);
        setErrors((prev) => ({ ...prev, form: '내 정보를 불러오지 못했습니다.' }));
        toast.show('내 정보를 불러오지 못했습니다.', { type: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey, status, toast]);

  const handleChange = <K extends keyof ProfileForm>(
    field: K,
    value: ProfileForm[K]
  ) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
    setSavedMessage(null);
    setErrors((prev) => {
      if (!prev[field] && !prev.form) return prev;
      const next: ProfileErrors = { ...prev };
      delete next[field];
      if (next.form) {
        delete next.form;
      }
      return next;
    });
  };

  const onSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form) return;
    const validation = validateProfileForm(form);
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      setSavedMessage(null);
      toast.show('입력값을 다시 확인해주세요.', { type: 'error' });
      return;
    }
    setBusy(true);
    try {
      const payload = buildProfilePayload(form);
      const updated = await updateMe(payload);
      setMe(updated);
      setForm(toFormState(updated));
      setErrors({});
      const message = '변경사항을 저장했습니다. 동문 수첩에는 선택한 공개 범위에 따라 표시됩니다.';
      setSavedMessage(message);
      toast.show('변경사항을 저장했습니다.', { type: 'success' });
    } catch (error) {
      const messageForToast = error instanceof ApiError
        ? memberApiErrorToMessage(error.code, error.message)
        : '내 정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.';
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setErrors((prev) => ({
            ...prev,
            form: '로그인 세션이 만료되었습니다. 다시 로그인해주세요.',
          }));
        } else if (error.status === 422) {
          setErrors((prev) => ({
            ...prev,
            form: '서버 검증을 통과하지 못했습니다. 입력값을 다시 확인해주세요.',
          }));
        } else {
          setErrors((prev) => ({ ...prev, form: messageForToast }));
        }
      } else {
        setErrors((prev) => ({ ...prev, form: messageForToast }));
      }
      toast.show(messageForToast, { type: 'error' });
      setSavedMessage(null);
    } finally {
      setBusy(false);
    }
  };

  const onAvatarUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.show('이미지 파일만 업로드할 수 있습니다.', { type: 'error' });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.show('이미지 파일 크기가 너무 큽니다. (최대 2MB)', { type: 'error' });
      return;
    }
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const updated = await updateAvatar(formData);
      setMe(updated);
      setForm(toFormState(updated));
      setErrors((prev) => {
        if (!prev.form) return prev;
        const rest = { ...prev };
        delete rest.form;
        return rest;
      });
      toast.show('프로필 사진이 업데이트되었습니다.', { type: 'success' });
    } catch (error) {
      const message = error instanceof ApiError
        ? memberApiErrorToMessage(error.code, error.message)
        : '프로필 사진을 올리지 못했습니다. 잠시 후 다시 시도해 주세요.';
      toast.show(message, { type: 'error' });
    } finally {
      setAvatarUploading(false);
    }
  };

  const visibilityHelpId = 'profile-visibility-help';
  const formErrorId = 'profile-form-error';

  const informationStatus = (() => {
    if (status === 'loading') return 'loading';
    if (status === 'unauthorized') return 'unauthorized';
    if (status === 'error') return 'auth-error';
    if (!form || !me) return errors.form ? 'error' : 'fetching';
    return 'ready';
  })();

  let body: ReactNode;
  if (informationStatus === 'loading') {
    body = <p className="text-sm text-text-muted">로딩 중…</p>;
  } else if (informationStatus === 'unauthorized') {
    body = <p className="text-sm text-text-muted">로그인 후 이용하세요.</p>;
  } else if (informationStatus === 'auth-error') {
    body = <div role="alert" className="space-y-3 rounded-xl bg-state-error-subtle p-4 text-sm text-state-error"><p>로그인 상태를 확인하지 못했습니다.</p><Button variant="secondary" onClick={() => void retryAuth()}>다시 확인하기</Button></div>;
  } else if (informationStatus === 'fetching') {
    body = <p className="text-sm text-text-muted">정보를 불러오는 중…</p>;
  } else if (informationStatus === 'error') {
    body = <div role="alert" className="space-y-3 rounded-xl bg-state-error-subtle p-4 text-sm text-state-error"><p>{errors.form}</p><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => { setErrors({}); setReloadKey((value) => value + 1); }}>다시 불러오기</Button><Link href="/support/contact" className="text-link inline-flex min-h-11 items-center">사무국에 문의하기</Link></div></div>;
  } else {
    const draft = form as ProfileForm;
    const profile = me as MemberDto;
    const isDirty = JSON.stringify(draft) !== JSON.stringify(toFormState(profile));
    body = (
      <div className="flex flex-col gap-6">
        <AvatarUploader
          avatarUrl={profile.avatar_url}
          uploading={avatarUploading}
          onUpload={onAvatarUpload}
        />
        <ChangeRequestSection profile={profile} />
        <ProfileFormSection
          draft={draft}
          profile={profile}
          errors={errors}
          busy={busy}
          onSubmit={onSave}
          onChange={handleChange}
          visibilityHelpId={visibilityHelpId}
          formErrorId={formErrorId}
          isDirty={isDirty}
          savedMessage={savedMessage}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <header className="space-y-2"><h1 className="text-2xl font-semibold">내 정보와 공개 범위</h1><p className="text-sm text-text-muted">연락처와 소속 정보를 최신으로 유지하고, 동문 수첩에 누구에게 보여줄지 선택해 주세요.</p></header>
      {body}
    </div>
  );
}
