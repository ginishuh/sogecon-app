"use client";

import { ADMIN_PERMISSION_TOKENS } from '../../../lib/rbac';

const BASE_ROLE_TOKENS = ['member', 'admin', 'super_admin'] as const;
export const KNOWN_ROLE_TOKENS = [...BASE_ROLE_TOKENS, ...ADMIN_PERMISSION_TOKENS];
export const KNOWN_ROLE_SET = new Set<string>(KNOWN_ROLE_TOKENS);

export function normalizeRoles(roles: string[]): string[] {
  return Array.from(
    new Set(
      roles
        .filter((role) => role.trim().length > 0)
        .map((role) => role.trim().toLowerCase())
    )
  );
}

export function roleLabel(role: string): string {
  if (role === 'member') return 'member';
  if (role === 'admin') return 'admin';
  if (role === 'super_admin') return 'super_admin';
  if (role === 'admin_posts') return '게시물 관리';
  if (role === 'admin_events') return '행사 관리';
  if (role === 'admin_hero') return '홈 배너 관리';
  if (role === 'admin_notifications') return '알림 관리';
  if (role === 'admin_signup') return '가입신청 심사';
  if (role === 'admin_roles') return '권한 관리';
  return role;
}

export function RoleChecklist({
  studentId,
  draftRoles,
  disabled,
  onToggle,
}: {
  studentId: string;
  draftRoles: string[];
  disabled: boolean;
  onToggle: (studentId: string, role: string, checked: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1">
      {KNOWN_ROLE_TOKENS.map((role) => (
        <label key={`${studentId}:${role}`} className="text-xs text-text-primary">
          <input
            type="checkbox"
            className="mr-1 align-middle"
            checked={draftRoles.includes(role)}
            disabled={disabled}
            onChange={(e) => onToggle(studentId, role, e.currentTarget.checked)}
          />
          {roleLabel(role)}
        </label>
      ))}
    </div>
  );
}
