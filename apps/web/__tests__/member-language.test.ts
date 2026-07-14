import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { apiErrorToMessage, memberApiErrorToMessage } from '../lib/error-map';
import { MEMBER_LANGUAGE } from '../lib/member-language';

const PUBLIC_COPY_FILES = [
  'app/activate/page.tsx',
  'app/faq/page.tsx',
  'app/login/page.tsx',
  'app/me/change-request.tsx',
  'app/me/page.tsx',
  'app/signup/page.tsx',
  'app/support/contact/page.tsx',
  'app/privacy/page.tsx',
  'components/drawer-menu.tsx',
  'components/header-notify-cta.tsx',
  'components/notify-cta.tsx',
  'components/site-header.tsx',
  'lib/activation.ts',
  'lib/member-language.ts',
];

function publicCopySource(): string {
  return PUBLIC_COPY_FILES.map((file) =>
    readFileSync(resolve(import.meta.dirname, '..', file), 'utf8')
  ).join('\n');
}

describe('동문 사용자 언어', () => {
  it('공개 화면 소스에 내부 용어 기반 안내 문구를 두지 않는다', () => {
    const source = publicCopySource();

    expect(source).not.toMatch(/VAPID 키가/);
    expect(source).not.toMatch(/서비스 워커 등록/);
    expect(source).not.toMatch(/구독 생성/);
    expect(source).not.toMatch(/활성화 토큰/);
    expect(source).not.toMatch(/관리자 문의/);
    expect(source).not.toMatch(/권한에 따라 접근/);
    expect(source).not.toMatch(/활성화 및 로그인/);
    expect(source).not.toMatch(/알림을 (?:활성화|해제)/);
    expect(source).not.toMatch(/웹 푸시/);
    expect(source).not.toMatch(/회원활성화|리다이렉트|디바운스|관리자 콘솔|푸시 발송/);
    expect(source).not.toMatch(/관리자 승인/);
  });

  it('핵심 행동 문구를 모든 진입점에서 공유한다', () => {
    expect(MEMBER_LANGUAGE.signup).toBe('동문 가입 신청');
    expect(MEMBER_LANGUAGE.activation).toBe('첫 로그인 설정');
    expect(MEMBER_LANGUAGE.notificationOnSuccess).toBe('새 소식 알림을 켰습니다.');
    expect(MEMBER_LANGUAGE.notificationOffSuccess).toBe('새 소식 알림을 껐습니다.');

    const source = publicCopySource();
    expect(source.match(/MEMBER_LANGUAGE\.signup/g)).toHaveLength(4);
    expect(source.match(/MEMBER_LANGUAGE\.activation/g)).toHaveLength(3);
    expect(source.match(/MEMBER_LANGUAGE\.notificationOnSuccess/g)).toHaveLength(2);
    expect(source.match(/MEMBER_LANGUAGE\.notificationOffSuccess/g)).toHaveLength(2);
  });

  it('내부 오류 문자열은 일반 안내로 대체한다', () => {
    const expected = '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';

    expect(memberApiErrorToMessage(undefined, '[object Object]')).toBe(expected);
    expect(memberApiErrorToMessage(undefined, 'super_admin_required')).toBe(expected);
    expect(memberApiErrorToMessage(undefined, 'VAPID token error')).toBe(expected);
    expect(memberApiErrorToMessage(undefined, '활성화 토큰 오류')).toBe(expected);
    expect(memberApiErrorToMessage(undefined, 'HTTP 500')).toBe(expected);
    expect(
      memberApiErrorToMessage(
        undefined,
        'value is not a valid email address: reserved domain',
      ),
    ).toBe(expected);
  });

  it('등록된 오류와 안전한 한국어 상세 안내는 보존한다', () => {
    expect(memberApiErrorToMessage('member_not_active')).toBe(
      '아직 이용할 수 없는 계정입니다. 동문회 사무국에 문의해 주세요.'
    );
    expect(memberApiErrorToMessage(undefined, '비밀번호를 확인해 주세요.')).toBe(
      '비밀번호를 확인해 주세요.'
    );
  });

  it('운영자 오류 매핑은 업무에 필요한 상세 안내를 보존한다', () => {
    expect(apiErrorToMessage(undefined, '활성화 토큰 발급 상태를 확인해 주세요.')).toBe(
      '활성화 토큰 발급 상태를 확인해 주세요.'
    );
  });
});
