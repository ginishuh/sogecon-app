import { describe, expect, it } from 'vitest';

import { isDirectoryConsentExemptPath, needsDirectoryConsent } from '../lib/directory-consent';
import type { Session } from '../services/auth';

const member = (consent: string | null | undefined): Session => ({
  kind: 'member',
  student_id: '20250001',
  email: 'member@example.com',
  name: '테스트',
  roles: ['member'],
  directory_consent_at: consent,
});

describe('동문 수첩 공개 동의 가드', () => {
  it('일반 회원은 동의 시각이 null일 때만 동의 화면이 필요하다', () => {
    expect(needsDirectoryConsent(member(null))).toBe(true);
    expect(needsDirectoryConsent(member('2026-08-19T00:00:00Z'))).toBe(false);
    expect(needsDirectoryConsent(member(undefined))).toBe(false);
  });

  it('운영자 세션은 동의 화면을 강제하지 않는다', () => {
    expect(needsDirectoryConsent({
      kind: 'admin',
      student_id: '__seed__admin',
      email: 'admin@example.com',
      name: 'Admin',
      roles: ['member', 'admin', 'super_admin'],
      directory_consent_at: null,
    })).toBe(false);
  });

  it('처리방침·문의·비밀번호 만들기는 동의 전에 열어 둔다', () => {
    expect(isDirectoryConsentExemptPath('/directory-consent')).toBe(true);
    expect(isDirectoryConsentExemptPath('/privacy')).toBe(true);
    expect(isDirectoryConsentExemptPath('/activate')).toBe(true);
    expect(isDirectoryConsentExemptPath('/')).toBe(false);
    expect(isDirectoryConsentExemptPath('/me')).toBe(false);
  });
});
