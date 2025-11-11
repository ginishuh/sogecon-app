import { NextRequest, NextResponse } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/csp', () => ({
  buildCspDirective: vi.fn(() => 'mock-csp'),
}));

import { buildCspDirective } from '../lib/csp';
import { middleware } from '../middleware';

describe('middleware', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('생성된 nonce를 CSP 빌더에 전달하고 헤더를 주입한다', () => {
    let forwardedHeaders: Headers | undefined;
    const stubResponse = new NextResponse(null, { headers: new Headers() });

    const spy = vi
      .spyOn(NextResponse, 'next')
      .mockImplementation((init) => {
        forwardedHeaders = init?.request?.headers as Headers | undefined;
        return stubResponse;
      });

    const req = new NextRequest('https://example.com/', { headers: new Headers() });

    const response = middleware(req);

    expect(spy).toHaveBeenCalled();
    expect(forwardedHeaders?.get('x-nonce')).toBeTruthy();

    const mockedBuildCsp = vi.mocked(buildCspDirective);
    const callArgs = mockedBuildCsp.mock.calls[0][0];
    expect(callArgs.nonce).toBe(forwardedHeaders?.get('x-nonce'));
    expect(response.headers.get('Content-Security-Policy')).toBe('mock-csp');
  });
});
