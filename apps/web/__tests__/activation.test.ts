import { describe, expect, it, afterEach, vi } from 'vitest';

import { buildActivationUrl, buildActivationMessage } from '../lib/activation';

describe('buildActivationUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('클라이언트 환경에서 window.location.origin을 base로 사용한다', () => {
    vi.stubGlobal('window', { location: { origin: 'https://my.app' } });
    const url = buildActivationUrl('abc123');
    expect(url).toBe('https://my.app/activate?token=abc123');
  });

  it('토큰에 특수문자가 있으면 인코딩한다', () => {
    vi.stubGlobal('window', { location: { origin: 'https://my.app' } });
    const url = buildActivationUrl('a+b=c&d');
    expect(url).toBe('https://my.app/activate?token=a%2Bb%3Dc%26d');
  });

  it('서버 환경에서 siteConfig.url을 base로 사용한다', () => {
    // window가 undefined인 서버 환경 시뮬레이션
    vi.stubGlobal('window', undefined);
    const url = buildActivationUrl('token123');
    expect(url).toContain('/activate?token=token123');
  });

  it('base에 trailing slash가 있어도 올바른 경로를 생성한다', () => {
    vi.stubGlobal('window', { location: { origin: 'https://my.app/' } });
    const url = buildActivationUrl('abc123');
    expect(url).toBe('https://my.app/activate?token=abc123');
  });
});

describe('buildActivationMessage', () => {
  it('이름, 학번, URL을 포함한 안내문구를 반환한다', () => {
    const msg = buildActivationMessage('홍길동', '20240001', 'https://my.app/activate?token=abc');
    expect(msg).toContain('홍길동');
    expect(msg).toContain('20240001');
    expect(msg).toContain('https://my.app/activate?token=abc');
    expect(msg).toContain('가입이 승인되었습니다');
    expect(msg).toContain('비밀번호를 설정');
  });

  it('줄바꿈이 포함되어 있다', () => {
    const msg = buildActivationMessage('홍길동', '20240001', 'https://example.com');
    expect(msg).toContain('\n');
  });
});
