import { describe, expect, it } from 'vitest';

import { buildCspDirective } from '../lib/csp';

describe('buildCspDirective', () => {
  it('includes nonce when 정책이 완화되지 않은 경우', () => {
    const csp = buildCspDirective({ nonce: 'abc123', relaxCsp: false });
    expect(csp).toMatch(/script-src 'self' 'nonce-abc123'/);
  });

  it('dev/프리뷰 완화 시에는 HMR 허용 지시어를 포함한다', () => {
    const csp = buildCspDirective({ nonce: 'test', relaxCsp: true });
    expect(csp).toMatch(/script-src .*'unsafe-inline'.*'unsafe-eval'.*wasm-unsafe-eval/);
    expect(csp).toContain('connect-src');
    expect(csp).toContain('ws:');
  });

  it('Analytics와 API Origin을 필요에 따라 추가한다', () => {
    const csp = buildCspDirective({
      nonce: 'test',
      relaxCsp: false,
      analyticsId: 'G-123456',
      apiBase: 'https://api.example.com/v1',
    });

    expect(csp).toContain('https://www.googletagmanager.com');
    expect(csp).toContain('https://www.google-analytics.com');
    expect(csp).toContain('https://api.example.com');
  });

  it('잘못된 API Origin은 무시한다', () => {
    const csp = buildCspDirective({ nonce: 'n', relaxCsp: false, apiBase: 'not-a-url' });
    expect(csp).not.toContain('not-a-url');
  });
});
