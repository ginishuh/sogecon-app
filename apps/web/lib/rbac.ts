import type { Session } from '../services/auth';

export const ADMIN_PERMISSION_TOKENS = [
  'admin_posts',
  'admin_events',
  'admin_hero',
  'admin_notifications',
  'admin_signup',
  'admin_roles',
] as const;

export type AdminPermissionToken = (typeof ADMIN_PERMISSION_TOKENS)[number];

const ADMIN_PERMISSION_SET = new Set<string>(ADMIN_PERMISSION_TOKENS);

function ensureRoles(roles: readonly string[] | undefined): string[] {
  if (!Array.isArray(roles)) return [];
  const normalized = roles
    .filter((role): role is string => typeof role === 'string')
    .map((role) => role.trim().toLowerCase())
    .filter((role) => role.length > 0);
  return Array.from(new Set(normalized));
}

export function isAdminSession(session: Session | undefined | null): boolean {
  const roles = ensureRoles(session?.roles);
  return roles.includes('admin') || roles.includes('super_admin');
}

export function isSuperAdminSession(session: Session | undefined | null): boolean {
  const roles = ensureRoles(session?.roles);
  return roles.includes('super_admin');
}

export function hasPermission(
  roles: readonly string[] | undefined,
  permission: AdminPermissionToken,
  options?: { allowAdminFallback?: boolean }
): boolean {
  const normalized = ensureRoles(roles);
  const allowAdminFallback = options?.allowAdminFallback ?? false;

  if (normalized.includes('super_admin')) return true;
  if (normalized.includes(permission)) return true;
  if (allowAdminFallback && normalized.includes('admin')) return true;
  return false;
}

export function hasPermissionSession(
  session: Session | undefined | null,
  permission: AdminPermissionToken,
  options?: { allowAdminFallback?: boolean }
): boolean {
  return hasPermission(session?.roles, permission, options);
}

export function filterKnownAdminPermissions(
  roles: readonly string[] | undefined
): AdminPermissionToken[] {
  const normalized = ensureRoles(roles);
  return normalized.filter(
    (role): role is AdminPermissionToken => ADMIN_PERMISSION_SET.has(role)
  );
}
