import type { Event } from '../services/events';

export type EventListView = 'upcoming' | 'past';
export type EventTiming = 'upcoming' | 'ongoing' | 'past';

type EventPageLoader = (params: { limit?: number; offset?: number }) => Promise<Event[]>;

export async function loadAllEvents(
  loadPage: EventPageLoader,
  pageSize = 100,
): Promise<Event[]> {
  const events: Event[] = [];
  let offset = 0;

  while (true) {
    const page = await loadPage({ limit: pageSize, offset });
    events.push(...page);
    if (page.length < pageSize) return events;
    offset += pageSize;
  }
}

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
  return { label: '예정', variant: 'success' as const };
}
