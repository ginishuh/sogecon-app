import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();

vi.mock('../lib/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

import { upsertEventRsvp } from '../services/events';

describe('events service RSVP authority', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue(undefined);
  });

  it('sends only status because the server owns member_id', async () => {
    await upsertEventRsvp(17, 'going');

    expect(apiFetchMock).toHaveBeenCalledWith('/events/17/rsvp', {
      method: 'POST',
      body: JSON.stringify({ status: 'going' }),
    });
  });
});
