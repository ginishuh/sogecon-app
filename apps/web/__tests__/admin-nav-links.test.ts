import { describe, expect, it } from 'vitest';

import { ADMIN_NAV_LINKS } from '../components/admin-nav-links';

describe('admin navigation permissions', () => {
  it('모든 관리자 링크에 세부 권한을 명시한다', () => {
    expect(ADMIN_NAV_LINKS.every((link) => link.permission !== undefined)).toBe(true);
  });

  it('문의 내역은 admin_support 권한으로 보호한다', () => {
    expect(ADMIN_NAV_LINKS.find((link) => link.href === '/admin/support')).toMatchObject({
      permission: 'admin_support',
    });
  });
});
