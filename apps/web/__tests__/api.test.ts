import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiFetch, ApiError } from '../lib/api';

describe('apiFetch 오류 정규화', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('Problem Details의 detail 문자열과 code를 사용한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            type: 'about:blank',
            status: 403,
            code: 'admin_permission_required',
            detail: '이 작업을 수행할 운영 권한이 없습니다.',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );

    await expect(apiFetch('/admin/signup-requests')).rejects.toEqual(
      new ApiError(403, '이 작업을 수행할 운영 권한이 없습니다.', 'admin_permission_required')
    );
  });

  it('422는 detail 문자열을 우선하고 errors extension은 파싱에 쓰지 않는다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            type: 'about:blank',
            status: 422,
            code: 'validation_error',
            detail: '입력값을 확인해 주세요.',
            errors: [
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
      new ApiError(422, '입력값을 확인해 주세요.', 'validation_error')
    );
  });

  it('브라우저 요청에서 세션 credentials를 유지한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/posts/1');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/posts/1'),
      expect.objectContaining({
        credentials: 'include',
      })
    );
  });
});
