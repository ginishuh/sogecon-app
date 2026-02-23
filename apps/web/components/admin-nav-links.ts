import type { Route } from 'next';
import type { AdminPermissionToken } from '../lib/rbac';

export type AdminNavLink = {
  href: Route;
  label: string;
  permission?: AdminPermissionToken;
};

export const ADMIN_NAV_LINKS: readonly AdminNavLink[] = [
  { href: '/admin/posts', label: '게시물 관리', permission: 'admin_posts' },
  { href: '/admin/events', label: '행사 관리', permission: 'admin_events' },
  { href: '/admin/hero', label: '홈 배너 관리', permission: 'admin_hero' },
  { href: '/admin/notifications', label: '알림 관리', permission: 'admin_notifications' },
  { href: '/admin/signup-requests', label: '가입신청 심사', permission: 'admin_signup' },
  { href: '/admin/profile-change-requests', label: '정보변경 심사', permission: 'admin_profile' },
  { href: '/admin/members', label: '회원 관리', permission: 'admin_roles' },
  { href: '/admin/support', label: '문의 내역' },
] as const;
