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

const ROLE_LABELS: Record<string, string> = {
  member: 'member',
  admin: 'admin',
  super_admin: 'super_admin',
  admin_posts: '게시물 관리',
  admin_events: '행사 관리',
  admin_hero: '홈 배너 관리',
  admin_notifications: '알림 관리',
  admin_signup: '가입신청 심사',
  admin_roles: '권한 관리',
  admin_profile: '프로필 변경 심사',
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

export function RoleChecklist({
  id,
  draftRoles,
  disabled,
  onToggle,
}: {
  id: string;
  draftRoles: string[];
  disabled: boolean;
  onToggle: (id: string, role: string, checked: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1">
      {KNOWN_ROLE_TOKENS.map((role) => (
        <label key={`${id}:${role}`} className="text-xs text-text-primary">
          <input
            type="checkbox"
            className="mr-1 align-middle"
            checked={draftRoles.includes(role)}
            disabled={disabled}
            onChange={(e) => onToggle(id, role, e.currentTarget.checked)}
          />
          {roleLabel(role)}
        </label>
      ))}
    </div>
  );
}
