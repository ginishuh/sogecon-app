import { vi } from 'vitest';

import { ApiError, apiFetch } from '../lib/api';
import { getOptionalRsvp } from '../services/rsvps';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});

const apiFetchMock = vi.mocked(apiFetch);

describe('getOptionalRsvp', () => {
  beforeEach(() => apiFetchMock.mockReset());

  it('신청 기록 404만 정상 미신청 상태로 변환한다', async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(404, 'RSVP not found', 'rsvp_not_found'));
    await expect(getOptionalRsvp(9, 1)).resolves.toBeNull();
  });

  it('서버 오류는 미신청으로 숨기지 않는다', async () => {
    const error = new ApiError(500, 'internal_error', 'internal_error');
    apiFetchMock.mockRejectedValueOnce(error);
    await expect(getOptionalRsvp(9, 1)).rejects.toBe(error);
  });

  it('다른 종류의 404는 미신청으로 숨기지 않는다', async () => {
    const error = new ApiError(404, 'Event not found', 'event_not_found');
    apiFetchMock.mockRejectedValueOnce(error);
    await expect(getOptionalRsvp(9, 1)).rejects.toBe(error);
  });
});
