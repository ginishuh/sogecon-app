import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiFetch, ApiError } from '../lib/api';

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
});
