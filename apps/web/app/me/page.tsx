"use client";

import Image from 'next/image';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { API_BASE, ApiError, apiFetch } from '../../lib/api';
import { useToast } from '../../components/toast';
import {
  buildProfilePayload,
  ProfileErrors,
  ProfileForm,
  ProfileVisibility,
  validateProfileForm,
} from './validation';

type MemberRead = {
  id: number;
  email: string;
  name: string;
  cohort: number;
  major: string | null;
  roles: string;
  visibility: ProfileVisibility;
  birth_date: string | null;
  birth_lunar: boolean | null;
  phone: string | null;
  company: string | null;
  department: string | null;
  job_title: string | null;
  company_phone: string | null;
  addr_personal: string | null;
  addr_company: string | null;
  industry: string | null;
  avatar_url: string | null;
};

const asDisplayString = (value: string | null): string => value ?? '';

const toFormState = (member: MemberRead): ProfileForm => ({
  name: member.name,
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
  'mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200';
const textareaClass =
  'mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200';

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

  return (
    <label className="flex flex-col">
      <span className="font-medium text-slate-800">{label}</span>
      {multiline ? (
        <textarea
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
        <p id={errorId} role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </label>
  );
}

type CheckboxFieldProps = {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
};

function CheckboxField({ label, checked, onChange }: CheckboxFieldProps) {
  return (
    <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800">
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

  return (
    <label className="flex flex-col">
      <span className="font-medium text-slate-800">공개 범위</span>
      <select
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value as ProfileVisibility)}
        aria-describedby={describedBy}
      >
        <option value="all">전체 공개</option>
        <option value="cohort">기수 한정 공개</option>
        <option value="private">비공개</option>
      </select>
      <p id={helpId} className="mt-1 text-xs text-slate-500">
        전체 공개는 모든 회원에게 노출되며, 기수 한정은 같은 기수 회원만 볼 수 있습니다. 비공개는 본인만 확인
        가능합니다.
      </p>
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </label>
  );
}

function ProfileSummary({ profile }: { profile: MemberRead }) {
  return (
    <dl className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
      <div className="flex justify-between">
        <dt className="font-medium text-slate-700">이메일</dt>
        <dd>{profile.email}</dd>
      </div>
      <div className="mt-1 flex justify-between">
        <dt className="font-medium text-slate-700">기수</dt>
        <dd>{profile.cohort}</dd>
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
      className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
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
      <div className="relative h-20 w-20 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
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
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
            사진 없음
          </div>
        )}
        {uploading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs text-emerald-600">
            업로드 중…
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-1 text-xs text-slate-600">
        <button
          type="button"
          onClick={handleButtonClick}
          disabled={uploading}
          className="w-fit rounded border border-emerald-600 px-3 py-1 text-emerald-600 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploading ? '업로드 중…' : '이미지 선택'}
        </button>
        <p>최대 512px · 100KB · JPG/PNG/WEBP</p>
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
  profile: MemberRead;
  errors: ProfileErrors;
  busy: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onChange: <K extends keyof ProfileForm>(field: K, value: ProfileForm[K]) => void;
  visibilityHelpId: string;
  formErrorId: string;
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
}: ProfileFormSectionProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 text-sm"
      aria-describedby={errors.form ? formErrorId : undefined}
    >
      <ProfileSummary profile={profile} />
      <FormErrorMessage message={errors.form} id={formErrorId} />
      <TextField field="name" label="이름" draft={draft} errors={errors} onChange={onChange} />
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
      <button
        disabled={busy}
        className="rounded bg-emerald-600 px-4 py-2 text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? '저장 중…' : '저장'}
      </button>
    </form>
  );
}

export default function MePage() {
  const { status } = useAuth();
  const toast = useToast();
  const [me, setMe] = useState<MemberRead | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [busy, setBusy] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

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
        const data = await apiFetch<MemberRead>('/me/');
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
  }, [status, toast]);

  const handleChange = <K extends keyof ProfileForm>(
    field: K,
    value: ProfileForm[K]
  ) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
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
      toast.show('입력값을 다시 확인해주세요.', { type: 'error' });
      return;
    }
    setBusy(true);
    try {
      const payload = buildProfilePayload(form);
      const updated = await apiFetch<MemberRead>('/me/', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setMe(updated);
      setForm(toFormState(updated));
      setErrors({});
      toast.show('저장되었습니다.', { type: 'success' });
    } catch (error) {
      const messageForToast =
        error instanceof ApiError ? error.message : '요청 처리 중 오류가 발생했습니다.';
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
      const updated = await apiFetch<MemberRead>('/me/avatar', {
        method: 'POST',
        body: formData,
      });
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
      const message =
        error instanceof ApiError ? error.message : '이미지 업로드 중 오류가 발생했습니다.';
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
    if (!form || !me) return 'fetching';
    return 'ready';
  })();

  let body: ReactNode;
  if (informationStatus === 'loading') {
    body = <p className="text-sm text-slate-500">로딩 중…</p>;
  } else if (informationStatus === 'unauthorized') {
    body = <p className="text-sm text-slate-600">로그인 후 이용하세요.</p>;
  } else if (informationStatus === 'fetching') {
    body = <p className="text-sm text-slate-600">정보를 불러오는 중…</p>;
  } else {
    const draft = form as ProfileForm;
    const profile = me as MemberRead;
    body = (
      <div className="flex flex-col gap-6">
        <AvatarUploader
          avatarUrl={profile.avatar_url}
          uploading={avatarUploading}
          onUpload={onAvatarUpload}
        />
        <ProfileFormSection
          draft={draft}
          profile={profile}
          errors={errors}
          busy={busy}
          onSubmit={onSave}
          onChange={handleChange}
          visibilityHelpId={visibilityHelpId}
          formErrorId={formErrorId}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl p-6">
      <h2 className="mb-4 text-xl font-semibold">내 정보</h2>
      {body}
    </div>
  );
}
