import type { Event } from '../services/events';

export type EventListView = 'upcoming' | 'past';
export type EventTiming = 'upcoming' | 'ongoing' | 'past';

export function getEventTiming(event: Event, now = new Date()): EventTiming {
  const startsAt = new Date(event.starts_at).getTime();
  const endsAt = new Date(event.ends_at).getTime();
  const current = now.getTime();

  if (endsAt < current) return 'past';
  if (startsAt <= current) return 'ongoing';
  return 'upcoming';
}

export function selectEvents(
  events: Event[],
  view: EventListView,
  now = new Date(),
): Event[] {
  const selected = events.filter((event) => {
    const timing = getEventTiming(event, now);
    return view === 'past' ? timing === 'past' : timing !== 'past';
  });

  return selected.sort((left, right) => {
    const difference = new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime();
    return view === 'past' ? -difference : difference;
  });
}

export function getEventStatus(event: Event, now = new Date()) {
  const timing = getEventTiming(event, now);
  if (timing === 'ongoing') return { label: '진행 중', variant: 'info' as const };
  if (timing === 'past') return { label: '종료', variant: 'neutral' as const };
  return { label: '신청 가능', variant: 'success' as const };
}
