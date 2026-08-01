import { describe, expect, it } from 'vitest';

import { getAdminPostPublicationState } from '../lib/admin-post-status';

describe('관리자 게시물 발행 상태', () => {
  const now = new Date('2026-08-01T12:00:00Z');

  it('발행 시각이 없으면 초안이다', () => {
    expect(getAdminPostPublicationState(null, now)).toBe('draft');
  });

  it('현재 시각 이후면 예약이다', () => {
    expect(getAdminPostPublicationState('2026-08-01T12:00:01Z', now)).toBe('scheduled');
  });

  it('현재 시각까지 도달했으면 공개다', () => {
    expect(getAdminPostPublicationState('2026-08-01T12:00:00Z', now)).toBe('published');
  });
});
