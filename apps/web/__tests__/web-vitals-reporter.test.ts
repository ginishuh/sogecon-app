import { describe, expect, it, vi } from 'vitest';
import type { Metric } from 'web-vitals';

import {
  buildWebVitalPayload,
  postWebVital,
} from '../components/web-vitals-reporter';

describe('Web Vitals v5 RUM payload', () => {
  it('rating과 navigationType을 포함하고 개인정보·query를 제외한다', () => {
    vi.setSystemTime(new Date('2026-07-12T00:00:00Z'));
    window.history.replaceState({}, '', '/events?member=private');
    const metric: Metric = {
      name: 'LCP',
      value: 1234.567,
      delta: 12.345,
      id: 'v5-1',
      entries: [],
      rating: 'good',
      navigationType: 'back-forward-cache',
    };

    const payload = buildWebVitalPayload(metric);

    expect(payload).toMatchObject({
      name: 'LCP',
      id: 'v5-1',
      value: 1234.57,
      delta: 12.35,
      rating: 'good',
      path: '/events',
      navType: 'back-forward-cache',
    });
    expect(payload).not.toHaveProperty('email');
    expect(payload).not.toHaveProperty('student_id');
    expect(payload.path).not.toContain('?');
  });

  it('beacon 실패 시 keepalive 요청으로 대체하고 전송 실패를 전파하지 않는다', async () => {
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: vi.fn(() => false),
    });
    const sendBeacon = vi.spyOn(navigator, 'sendBeacon').mockReturnValue(false);
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new TypeError('network unavailable'));

    expect(() => postWebVital('{"name":"LCP"}')).not.toThrow();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    expect(sendBeacon).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/rum/vitals'),
      expect.objectContaining({ method: 'POST', keepalive: true }),
    );
  });
});
