import { describe, expect, it } from 'vitest';
import {
  hasPermission,
  hasPermissionSession,
  isAdminSession,
  isSuperAdminSession,
} from '../lib/rbac';

describe('rbac helpers', () => {
  it('super_admin은 모든 permission을 통과한다', () => {
    expect(hasPermission(['member', 'super_admin'], 'admin_roles')).toBe(true);
    expect(
      hasPermissionSession(
        {
          kind: 'admin',
          student_id: '20260001',
          email: 'admin@example.com',
          name: '관리자',
          roles: ['member', 'super_admin'],
        },
        'admin_events'
      )
    ).toBe(true);
  });

  it('admin 권한 fallback은 명시적으로 켠 경우에만 동작한다', () => {
    expect(hasPermission(['member', 'admin'], 'admin_events')).toBe(false);
    expect(
      hasPermission(['member', 'admin'], 'admin_events', {
        allowAdminFallback: true,
      })
    ).toBe(true);
  });

  it('관리자/슈퍼관리자 판별이 roles 기반으로 동작한다', () => {
    expect(
      isAdminSession({
        kind: 'admin',
        student_id: '20260002',
        email: 'ops@example.com',
        name: '운영진',
        roles: ['member', 'admin_roles'],
      })
    ).toBe(false);
    expect(
      isAdminSession({
        kind: 'admin',
        student_id: '20260003',
        email: 'ops2@example.com',
        name: '운영진2',
        roles: ['member', 'admin'],
      })
    ).toBe(true);
    expect(
      isSuperAdminSession({
        kind: 'admin',
        student_id: '20260004',
        email: 'super@example.com',
        name: '총관리자',
        roles: ['member', 'super_admin'],
      })
    ).toBe(true);
  });
});
