import {
  Buildings,
  LockSimple,
  ShieldCheck,
  UserCircle,
  UsersThree,
} from '@phosphor-icons/react';
import Image from 'next/image';
import { VISIBILITY_INFO } from '../../lib/member-experience';
import { API_BASE, type MemberDto } from '../../services/me';
import type { ProfileErrors, ProfileForm, ProfileVisibility } from './validation';

const fieldErrorId = (field: keyof ProfileForm) => `profile-${field}-error`;

const VISIBILITY_ICON = {
  all: UsersThree,
  cohort: UserCircle,
  private: LockSimple,
} satisfies Record<ProfileVisibility, typeof UsersThree>;

export function VisibilityField({
  value,
  errors,
  onChange,
  helpId,
}: {
  value: ProfileVisibility;
  errors: ProfileErrors;
  onChange: (next: ProfileVisibility) => void;
  helpId: string;
}) {
  const error = errors.visibility;
  const errorId = error ? fieldErrorId('visibility') : undefined;
  const options = Object.entries(VISIBILITY_INFO) as Array<
    [ProfileVisibility, (typeof VISIBILITY_INFO)[ProfileVisibility]]
  >;

  return (
    <fieldset className="space-y-1.5 sm:space-y-3" aria-describedby={[helpId, errorId].filter(Boolean).join(' ') || undefined}>
      <legend className="text-lg font-semibold text-text-primary sm:text-xl">공개 범위</legend>
      <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-neutral-border bg-white">
        {options.map(([option], index) => {
          const Icon = VISIBILITY_ICON[option];
          const selected = value === option;
          return (
            <label
              key={option}
              className={`relative flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1.5 px-2 py-2 text-center text-sm transition-colors sm:min-h-28 sm:gap-2 sm:py-3 ${
                index > 0 ? 'border-l border-neutral-border' : ''
              } ${selected ? 'bg-brand-50 text-brand-800' : 'text-text-secondary hover:bg-surface-raised'}`}
            >
              <input
                type="radio"
                name="profile-visibility"
                value={option}
                checked={selected}
                onChange={() => onChange(option)}
                className="sr-only"
              />
              <Icon size={26} weight={selected ? 'fill' : 'regular'} aria-hidden="true" />
              <span className="font-semibold">
                {option === 'all' ? '모든 동문' : option === 'cohort' ? '같은 기수' : '나만 보기'}
              </span>
            </label>
          );
        })}
      </div>
      <p id={helpId} className="flex items-start gap-2 text-sm leading-5 text-text-muted sm:leading-6">
        <ShieldCheck className="mt-0.5 shrink-0" size={20} aria-hidden="true" />
        <span>{VISIBILITY_INFO[value].description}</span>
      </p>
      <p className="sr-only" role="status">현재 선택: {VISIBILITY_INFO[value].label}</p>
      {error ? <p id={errorId} role="alert" className="text-xs text-state-error">{error}</p> : null}
    </fieldset>
  );
}

export function Avatar({ profile, previewUrl }: { profile: MemberDto; previewUrl?: string | null }) {
  const source = previewUrl ?? (profile.avatar_url ? `${API_BASE}${profile.avatar_url}` : null);
  return (
    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-neutral-border bg-surface-raised sm:h-24 sm:w-24">
      {source ? (
        <Image
          src={source}
          alt={previewUrl ? '선택한 프로필 사진 미리보기' : '현재 프로필 사진'}
          fill
          unoptimized
          sizes="96px"
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-brand-300">
          <UserCircle size={52} weight="thin" aria-hidden="true" />
          <span className="sr-only">등록된 프로필 사진 없음</span>
        </div>
      )}
    </div>
  );
}

export function ProfilePreview({ profile, draft }: { profile: MemberDto; draft: ProfileForm }) {
  const organization = draft.company || draft.job_title;
  return (
    <section aria-labelledby="profile-preview-title" className="space-y-2 sm:space-y-4">
      <h2 id="profile-preview-title" className="text-base font-semibold text-text-primary sm:text-xl">동문에게 이렇게 보여요</h2>
      <div className="rounded-2xl border border-neutral-border bg-white p-3 sm:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar profile={profile} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold text-text-primary">{profile.name}</p>
            <p className="mt-1 text-base text-text-muted">{profile.cohort}기</p>
            <div className="mt-4 border-t border-neutral-border pt-4">
              <p className="flex items-center gap-2 text-sm text-text-muted">
                {organization ? <Buildings size={19} aria-hidden="true" /> : <LockSimple size={19} aria-hidden="true" />}
                <span className="truncate">
                  {organization ? [draft.company, draft.job_title].filter(Boolean).join(' · ') : '소속 정보 비공개'}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
