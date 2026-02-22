"use client";

import { ADMIN_PERMISSION_TOKENS } from '../../../lib/rbac';

const BASE_ROLE_TOKENS = ['member', 'admin', 'super_admin'] as const;
export const KNOWN_ROLE_TOKENS = [...BASE_ROLE_TOKENS, ...ADMIN_PERMISSION_TOKENS];
export const KNOWN_ROLE_SET = new Set<string>(KNOWN_ROLE_TOKENS);

const ADMIN_PERM_SET = new Set<string>(ADMIN_PERMISSION_TOKENS);

export function normalizeRoles(roles: string[]): string[] {
  const deduped = Array.from(
    new Set(
      roles
        .filter((role) => role.trim().length > 0)
        .map((role) => role.trim().toLowerCase())
    )
  );

  const tokens = new Set(deduped);

  // 계층 정합성: super_admin → admin + 모든 세부권한
  if (tokens.has('super_admin')) {
    tokens.add('admin');
    for (const perm of ADMIN_PERMISSION_TOKENS) tokens.add(perm);
  } else if (!tokens.has('admin')) {
    // admin도 super_admin도 없으면 세부권한 제거
    for (const perm of ADMIN_PERMISSION_TOKENS) tokens.delete(perm);
  }

  // 원래 순서 유지 + 추가된 토큰은 뒤에
  const result = deduped.filter((r) => tokens.has(r));
  Array.from(tokens).forEach((t) => {
    if (!result.includes(t)) result.push(t);
  });
  return result;
}

/** toggleRole 시 계층 규칙에 따른 연쇄 변경 적용 */
export function applyRoleHierarchy(
  prev: string[],
  role: string,
  checked: boolean,
): string[] {
  let next: string[];
  if (checked) {
    next = [...prev.filter((t) => t !== role), role];
  } else {
    next = prev.filter((t) => t !== role);
  }

  // admin 해제 시 → 세부권한 전부 제거
  if (role === 'admin' && !checked) {
    next = next.filter((t) => !ADMIN_PERM_SET.has(t));
  }
  // super_admin 체크 시 → admin + 모든 세부권한 추가
  if (role === 'super_admin' && checked) {
    const toAdd = ['admin', ...ADMIN_PERMISSION_TOKENS];
    const existing = new Set(next);
    for (const t of toAdd) {
      if (!existing.has(t)) next.push(t);
    }
  }

  return normalizeRoles(next);
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
  const hasAdmin = draftRoles.includes('admin') || draftRoles.includes('super_admin');
  const hasSuperAdmin = draftRoles.includes('super_admin');

  return (
    <div className="grid grid-cols-2 gap-1">
      {KNOWN_ROLE_TOKENS.map((role) => {
        const isAdminPerm = ADMIN_PERM_SET.has(role);
        // member는 항상 체크 + 해제 불가
        const isMemberLocked = role === 'member';
        // admin 세부권한: admin/super_admin이 없으면 비활성화
        const permDisabled = isAdminPerm && !hasAdmin;
        // super_admin이면 세부권한 강제 체크 + 개별 해제 불가
        const forcedBySuperAdmin = isAdminPerm && hasSuperAdmin;
        const isChecked = draftRoles.includes(role) || forcedBySuperAdmin || isMemberLocked;
        const isDisabled = disabled || permDisabled || forcedBySuperAdmin || isMemberLocked;

        return (
          <label
            key={`${id}:${role}`}
            className={`text-xs ${permDisabled && !hasSuperAdmin ? 'text-text-muted' : 'text-text-primary'}`}
          >
            <input
              type="checkbox"
              className="mr-1 align-middle"
              checked={isChecked}
              disabled={isDisabled}
              onChange={(e) => onToggle(id, role, e.currentTarget.checked)}
            />
            {roleLabel(role)}
          </label>
        );
      })}
    </div>
  );
}
