"use client";

import { Buildings, Camera, CaretRight, CheckCircle, Phone } from '@phosphor-icons/react';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Button from '../../components/ui/button';
import { useToast } from '../../components/toast';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../lib/api';
import { memberApiErrorToMessage } from '../../lib/error-map';
import { getMe, updateAvatar, updateMe, type MemberDto } from '../../services/me';
import { ChangeRequestSection } from './change-request';
import { Avatar, ProfilePreview, VisibilityField } from './profile-overview';
import {
  buildProfilePayload,
  type ProfileErrors,
  type ProfileForm,
  validateProfileForm,
} from './validation';

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

const inputClass = [
  'mt-1 min-h-11 w-full min-w-0 rounded-md border border-neutral-border bg-white px-3 py-2 text-text-primary',
  'placeholder:text-text-muted focus:border-brand-500 focus:outline-hidden focus:ring-2 focus:ring-brand-400',
].join(' ');

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
  const sharedProps = {
    id: inputId,
    className: inputClass,
    value: draft[field],
    placeholder,
    'aria-invalid': Boolean(error),
    'aria-describedby': errorId,
  };

  return (
    <div className="min-w-0">
      <label htmlFor={inputId} className="font-medium text-text-primary">{label}</label>
      {multiline ? (
        <textarea
          {...sharedProps}
          rows={rows}
          onChange={(event) => onChange(field, event.target.value as ProfileForm[K])}
        />
      ) : (
        <input
          {...sharedProps}
          onChange={(event) => onChange(field, event.target.value as ProfileForm[K])}
        />
      )}
      {error ? <p id={errorId} role="alert" className="mt-1 text-xs text-state-error">{error}</p> : null}
    </div>
  );
}

function CheckboxField({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-1 text-sm font-medium text-text-primary">
      <input
        type="checkbox"
        className="h-5 w-5 accent-brand-700"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      생일을 음력으로 표시
    </label>
  );
}

function FormErrorMessage({ message, id }: { message?: string; id: string }) {
  if (!message) return null;
  return <p id={id} role="alert" className="rounded-lg bg-state-error-subtle px-4 py-3 text-sm text-state-error">{message}</p>;
}

function AvatarUploader({
  profile,
  uploading,
  onUpload,
}: {
  profile: MemberDto;
  uploading: boolean;
  onUpload: (file: File) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleInputChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const input = event.target;
    const file = input.files?.[0];
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
    <section aria-label="프로필 사진" className="flex min-w-0 items-center gap-4">
      <div className="relative shrink-0">
        <Avatar profile={profile} previewUrl={previewUrl} />
        <button
          type="button"
          aria-label={uploading ? '프로필 사진 업로드 중' : '프로필 사진 변경'}
          className="absolute -bottom-2 -right-2 flex h-11 w-11 items-center justify-center rounded-full border border-neutral-border bg-white text-brand-700 shadow-sm transition-colors hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60 sm:hidden"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          <Camera size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="hidden min-w-0 space-y-1 sm:block">
        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          variant="secondary"
          size="sm"
        >
          {uploading ? '업로드 중…' : '사진 변경'}
        </Button>
        <p className="text-xs leading-5 text-text-muted">최대 2MB · JPG/PNG/WEBP</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleInputChange}
      />
    </section>
  );
}

function SectionToggle({
  id,
  title,
  summary,
  icon: Icon,
  open,
  onToggle,
}: {
  id: string;
  title: string;
  summary: string;
  icon: typeof Phone;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="flex min-h-16 w-full items-center gap-3 border-t border-neutral-border py-3 text-left first:border-t-0 sm:min-h-20 sm:py-4"
      aria-expanded={open}
      aria-controls={id}
      onClick={onToggle}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-raised text-text-secondary">
        <Icon size={23} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-text-primary">{title}</span>
        <span className="mt-1 block truncate text-sm text-text-muted">{summary}</span>
      </span>
      <CaretRight className={`shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} size={22} aria-hidden="true" />
    </button>
  );
}

const CONTACT_FIELDS: Array<keyof ProfileErrors> = ['email', 'birth_date', 'phone', 'addr_personal'];
const ORGANIZATION_FIELDS: Array<keyof ProfileErrors> = [
  'major',
  'company',
  'department',
  'job_title',
  'company_phone',
  'addr_company',
  'industry',
];

const hasAnyError = (errors: ProfileErrors, fields: Array<keyof ProfileErrors>) =>
  fields.some((field) => Boolean(errors[field]));

const summarizeValues = (values: string[], emptyMessage: string) => {
  const summary = values.filter(Boolean).join(' · ');
  return summary || emptyMessage;
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
}: {
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
}) {
  const [openSection, setOpenSection] = useState<'contact' | 'organization' | null>(null);
  const contactHasError = hasAnyError(errors, CONTACT_FIELDS);
  const organizationHasError = hasAnyError(errors, ORGANIZATION_FIELDS);

  useEffect(() => {
    if (contactHasError) setOpenSection('contact');
    else if (organizationHasError) setOpenSection('organization');
  }, [contactHasError, organizationHasError]);

  const contactSummary = summarizeValues([draft.email, draft.phone], '입력한 연락처가 없어요');
  const organizationSummary = summarizeValues(
    [draft.company, draft.department, draft.job_title],
    '소속 정보가 비어 있어요',
  );

  return (
    <form onSubmit={onSubmit} className="space-y-3 sm:space-y-7" aria-describedby={errors.form ? formErrorId : undefined}>
      <FormErrorMessage message={errors.form} id={formErrorId} />
      {savedMessage ? <p role="status" className="rounded-xl bg-state-success-subtle px-4 py-3 text-sm text-state-success">{savedMessage}</p> : null}

      <ProfilePreview profile={profile} draft={draft} />

      <VisibilityField
        value={draft.visibility}
        errors={errors}
        onChange={(next) => onChange('visibility', next)}
        helpId={visibilityHelpId}
      />

      <section aria-label="프로필 세부 정보" className="border-y border-neutral-border">
        <SectionToggle
          id="profile-contact-fields"
          title="연락처 정보"
          summary={contactSummary}
          icon={Phone}
          open={openSection === 'contact'}
          onToggle={() => setOpenSection((current) => (current === 'contact' ? null : 'contact'))}
        />
        <div id="profile-contact-fields" hidden={openSection !== 'contact'} className="grid gap-4 border-t border-neutral-border py-5 sm:grid-cols-2">
          <TextField field="email" label="이메일" draft={draft} errors={errors} onChange={onChange} />
          <TextField field="phone" label="휴대전화(선택)" draft={draft} errors={errors} onChange={onChange} placeholder="010-1234-5678" />
          <TextField field="birth_date" label="생일(선택)" draft={draft} errors={errors} onChange={onChange} placeholder="YYYY-MM-DD" />
          <CheckboxField checked={draft.birth_lunar} onChange={(next) => onChange('birth_lunar', next)} />
          <div className="sm:col-span-2">
            <TextField field="addr_personal" label="개인 주소(선택)" draft={draft} errors={errors} onChange={onChange} multiline />
          </div>
        </div>

        <SectionToggle
          id="profile-organization-fields"
          title="소속 정보"
          summary={organizationSummary}
          icon={Buildings}
          open={openSection === 'organization'}
          onToggle={() => setOpenSection((current) => (current === 'organization' ? null : 'organization'))}
        />
        <div id="profile-organization-fields" hidden={openSection !== 'organization'} className="grid gap-4 border-t border-neutral-border py-5 sm:grid-cols-2">
          <TextField field="major" label="전공(선택)" draft={draft} errors={errors} onChange={onChange} />
          <TextField field="industry" label="업종(선택)" draft={draft} errors={errors} onChange={onChange} />
          <TextField field="company" label="회사명(선택)" draft={draft} errors={errors} onChange={onChange} />
          <TextField field="department" label="부서(선택)" draft={draft} errors={errors} onChange={onChange} />
          <TextField field="job_title" label="직함(선택)" draft={draft} errors={errors} onChange={onChange} />
          <TextField field="company_phone" label="회사 연락처(선택)" draft={draft} errors={errors} onChange={onChange} placeholder="02-1234-5678" />
          <div className="sm:col-span-2">
            <TextField field="addr_company" label="회사 주소(선택)" draft={draft} errors={errors} onChange={onChange} multiline />
          </div>
        </div>
      </section>

      <div className="space-y-3">
        <Button type="submit" disabled={!isDirty} loading={busy} size="lg" className="w-full">
          {busy ? '저장 중…' : isDirty ? '변경사항 저장하기' : '저장된 상태입니다'}
        </Button>
        <Link href="/support/contact" className="text-link inline-flex min-h-11 w-full items-center justify-center text-sm">
          내 정보 수정이 어려우신가요? 사무국에 문의하기
        </Link>
      </div>
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
      return () => { cancelled = true; };
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
        setErrors((previous) => ({ ...previous, form: '내 정보를 불러오지 못했습니다.' }));
        toast.show('내 정보를 불러오지 못했습니다.', { type: 'error' });
      }
    })();
    return () => { cancelled = true; };
  }, [reloadKey, status, toast]);

  const handleChange = <K extends keyof ProfileForm>(field: K, value: ProfileForm[K]) => {
    setForm((previous) => (previous ? { ...previous, [field]: value } : previous));
    setSavedMessage(null);
    setErrors((previous) => {
      if (!previous[field] && !previous.form) return previous;
      const next = { ...previous };
      delete next[field];
      delete next.form;
      return next;
    });
  };

  const onSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
      const updated = await updateMe(buildProfilePayload(form));
      setMe(updated);
      setForm(toFormState(updated));
      setErrors({});
      const message = '변경사항을 저장했습니다. 동문 수첩에는 선택한 공개 범위에 따라 표시됩니다.';
      setSavedMessage(message);
      toast.show('변경사항을 저장했습니다.', { type: 'success' });
    } catch (error) {
      const message = error instanceof ApiError
        ? memberApiErrorToMessage(error.code, error.message)
        : '내 정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.';
      setErrors((previous) => ({
        ...previous,
        form: error instanceof ApiError && error.status === 401
          ? '로그인 세션이 만료되었습니다. 다시 로그인해주세요.'
          : error instanceof ApiError && error.status === 422
            ? '서버 검증을 통과하지 못했습니다. 입력값을 다시 확인해주세요.'
            : message,
      }));
      toast.show(message, { type: 'error' });
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
      const payload = new FormData();
      payload.append('avatar', file);
      const updated = await updateAvatar(payload);
      setMe(updated);
      setForm(toFormState(updated));
      setErrors((previous) => {
        const next = { ...previous };
        delete next.form;
        return next;
      });
      toast.show('프로필 사진이 업데이트되었습니다.', { type: 'success' });
    } catch (error) {
      toast.show(
        error instanceof ApiError
          ? memberApiErrorToMessage(error.code, error.message)
          : '프로필 사진을 올리지 못했습니다. 잠시 후 다시 시도해 주세요.',
        { type: 'error' },
      );
    } finally {
      setAvatarUploading(false);
    }
  };

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
      <div className="space-y-6 sm:space-y-8">
        <section aria-labelledby="profile-identity-title" className="grid grid-cols-[auto_1fr] items-center gap-4 border-b border-neutral-border pb-6 sm:gap-5 sm:pb-8">
          <AvatarUploader profile={profile} uploading={avatarUploading} onUpload={onAvatarUpload} />
          <div className="min-w-0">
            <h2 id="profile-identity-title" className="truncate text-2xl font-semibold text-text-primary">{profile.name} · {profile.cohort}기</h2>
            <p className={`mt-3 flex items-center gap-2 text-sm font-medium ${isDirty ? 'text-brand-700' : 'text-state-success'}`} role="status">
              <CheckCircle size={21} weight="fill" aria-hidden="true" />
              {isDirty ? '저장하지 않은 변경사항이 있어요' : '저장된 상태예요'}
            </p>
            <p className="mt-2 text-xs leading-5 text-text-muted sm:hidden">사진은 JPG, PNG, WEBP · 최대 2MB</p>
          </div>
        </section>

        <ProfileFormSection
          draft={draft}
          profile={profile}
          errors={errors}
          busy={busy}
          onSubmit={onSave}
          onChange={handleChange}
          visibilityHelpId="profile-visibility-help"
          formErrorId="profile-form-error"
          isDirty={isDirty}
          savedMessage={savedMessage}
        />

        <ChangeRequestSection profile={profile} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:space-y-8 sm:px-6 sm:py-10 lg:px-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">내 정보와 공개 범위</h1>
        <p className="sr-only max-w-2xl text-sm leading-6 text-text-muted sm:not-sr-only sm:text-base">연락처와 소속 정보를 최신으로 유지하고, 동문 수첩에 누구에게 보여줄지 선택해 주세요.</p>
      </header>
      {body}
    </div>
  );
}
