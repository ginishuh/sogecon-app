"use client";

import { useToast } from '../../../components/toast';
import {
  buildActivationMessage,
  buildActivationUrl,
} from '../../../lib/activation';
import type { DirectMemberCreateResponse } from '../../../services/admin-members';
import { CONTROL_BASE, CONTROL_SIZE, CONTROL_VARIANT } from '../../../components/ui/styles';

export type Feedback = { tone: 'success' | 'error'; message: string };
export type RoleFilter = 'all' | 'admin' | 'super_admin';

export const ROLE_FILTER_MATCHERS: Record<RoleFilter, (roles: string[]) => boolean> = {
  all: () => true,
  admin: (r) => r.includes('admin') || r.includes('super_admin'),
  super_admin: (r) => r.includes('super_admin'),
};

export function FeedbackBanner({ feedback }: { feedback: Feedback | null }) {
  if (feedback == null) return null;
  const cls =
    feedback.tone === 'success'
      ? 'border-state-success-ring bg-state-success-subtle text-state-success'
      : 'border-state-error-ring bg-state-error-subtle text-state-error';
  return (
    <div className={`rounded border px-3 py-2 text-sm ${cls}`} role="status">
      {feedback.message}
    </div>
  );
}

export function UnknownRoleHint({ unknownRoles }: { unknownRoles: string[] }) {
  if (unknownRoles.length === 0) return null;
  return <p className="mt-2 text-xs text-text-muted">기타 역할(그대로 유지): {unknownRoles.join(', ')}</p>;
}

export function SaveRoleButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`${CONTROL_BASE} ${CONTROL_SIZE.sm} ${CONTROL_VARIANT.primary}`}
      disabled={disabled}
      onClick={onClick}
    >
      저장
    </button>
  );
}

const ROLE_FILTER_OPTIONS: { value: RoleFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'admin', label: '관리자 이상' },
  { value: 'super_admin', label: '최고관리자' },
];

export function RoleFilterBar({
  current,
  onChange,
}: {
  current: RoleFilter;
  onChange: (filter: RoleFilter) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" aria-label="회원 역할 필터">
      {ROLE_FILTER_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={current === opt.value}
          className={`${CONTROL_BASE} ${CONTROL_SIZE.sm} ${
            current === opt.value
              ? CONTROL_VARIANT.primary
              : CONTROL_VARIANT.secondary
          }`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function ActivationTokenCard({
  lastCreate,
}: {
  lastCreate: DirectMemberCreateResponse | null;
}) {
  const { show } = useToast();
  if (lastCreate == null) return null;

  const { member, activation_token } = lastCreate;
  const activationUrl = buildActivationUrl(activation_token);
  const activationMessage = buildActivationMessage(
    member.name,
    member.student_id,
    activationUrl,
  );

  const copyBtnClass =
    'rounded border border-state-success-ring px-3 py-1 text-xs text-state-success hover:bg-white';

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    show(`${label} 복사됨`, { type: 'success' });
  };

  return (
    <div className="space-y-3 rounded border border-state-success-ring bg-state-success-subtle p-4">
      <p className="text-sm font-medium text-state-success">
        회원 생성 완료: {member.name} ({member.student_id})
      </p>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-state-success">활성화 토큰</span>
          <button type="button" className={copyBtnClass} onClick={() => copy(activation_token, '토큰')}>
            토큰 복사
          </button>
        </div>
        <p className="break-all rounded bg-white px-3 py-2 text-xs text-text-secondary">
          {activation_token}
        </p>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-state-success">활성화 링크</span>
          <button type="button" className={copyBtnClass} onClick={() => copy(activationUrl, '링크')}>
            링크 복사
          </button>
        </div>
        <p className="break-all rounded bg-white px-3 py-2 text-xs text-text-secondary">
          {activationUrl}
        </p>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-state-success">안내문구</span>
          <button type="button" className={copyBtnClass} onClick={() => copy(activationMessage, '안내문구')}>
            문구 복사
          </button>
        </div>
        <p className="whitespace-pre-wrap break-all rounded bg-white px-3 py-2 text-xs text-text-secondary">
          {activationMessage}
        </p>
      </div>
    </div>
  );
}
