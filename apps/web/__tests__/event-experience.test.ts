import { describe, expect, it, vi } from 'vitest';

import {
  getEventStatus,
  getEventTiming,
  loadAllEvents,
  selectEvents,
} from '../lib/event-experience';
import type { Event } from '../services/events';

const now = new Date('2026-07-13T12:00:00+09:00');

function makeEvent(id: number, startsAt: string, endsAt: string): Event {
  return {
    id,
    title: `행사 ${id}`,
    description: null,
    location: '서강대학교',
    starts_at: startsAt,
    ends_at: endsAt,
    capacity: 50,
  };
}

describe('행사 시기와 정렬', () => {
  const past = makeEvent(1, '2026-07-10T10:00:00+09:00', '2026-07-10T12:00:00+09:00');
  const ongoing = makeEvent(2, '2026-07-13T10:00:00+09:00', '2026-07-13T12:00:00+09:00');
  const upcoming = makeEvent(3, '2026-07-20T10:00:00+09:00', '2026-07-20T12:00:00+09:00');

  it('종료 경계와 진행 중 상태를 구분한다', () => {
    expect(getEventTiming(past, now)).toBe('past');
    expect(getEventTiming(ongoing, now)).toBe('ongoing');
    expect(getEventTiming(upcoming, now)).toBe('upcoming');
    expect(getEventStatus(ongoing, now).label).toBe('진행 중');
  });

  it('예정 탭은 가까운 순, 지난 탭은 최근 순으로 정렬한다', () => {
    expect(selectEvents([upcoming, past, ongoing], 'upcoming', now).map(({ id }) => id)).toEqual([2, 3]);
    const older = makeEvent(4, '2026-07-01T10:00:00+09:00', '2026-07-01T12:00:00+09:00');
    expect(selectEvents([older, past], 'past', now).map(({ id }) => id)).toEqual([1, 4]);
  });
});

describe('공개 행사 전체 조회', () => {
  it('첫 100건 뒤의 예정 행사까지 페이지를 이어서 읽는다', async () => {
    const oldEvents = Array.from({ length: 100 }, (_, index) =>
      makeEvent(index + 1, '2025-01-01T10:00:00+09:00', '2025-01-01T12:00:00+09:00'),
    );
    const futureEvent = makeEvent(101, '2027-01-01T10:00:00+09:00', '2027-01-01T12:00:00+09:00');
    const loadPage = vi.fn()
      .mockResolvedValueOnce(oldEvents)
      .mockResolvedValueOnce([futureEvent]);

    const events = await loadAllEvents(loadPage);

    expect(events).toHaveLength(101);
    expect(events.at(-1)?.id).toBe(101);
    expect(loadPage).toHaveBeenNthCalledWith(1, { limit: 100, offset: 0 });
    expect(loadPage).toHaveBeenNthCalledWith(2, { limit: 100, offset: 100 });
  });
});
