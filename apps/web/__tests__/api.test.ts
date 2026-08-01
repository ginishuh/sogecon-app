import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiFetch, ApiError } from '../lib/api';

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [{ name: 'session', value: 'admin-session' }],
  })),
}));

describe('apiFetch 오류 정규화', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('Pydantic 422 detail 배열을 사용자 메시지로 변환한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            detail: [
              {
                type: 'value_error',
                loc: ['body', 'password'],
                msg: 'Value error, 비밀번호는 UTF-8 기준 72바이트 이하여야 합니다.',
              },
            ],
          }),
          { status: 422, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );

    await expect(apiFetch('/auth/member/activate')).rejects.toEqual(
      new ApiError(422, '비밀번호는 UTF-8 기준 72바이트 이하여야 합니다.')
    );
  });

  it('서버 렌더링에서 요청 쿠키를 API로 전달한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const windowDesc = Object.getOwnPropertyDescriptor(globalThis, 'window');
    // SSR 경로: window이 없을 때만 next/headers 쿠키를 붙인다.
    Reflect.deleteProperty(globalThis, 'window');
    try {
      await apiFetch('/posts/1');
    } finally {
      if (windowDesc) Object.defineProperty(globalThis, 'window', windowDesc);
    }

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/posts/1'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Cookie: 'session=admin-session',
        }),
      })
    );
  });
});
