'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { listEvents, type Event } from '../../services/events';

export default function EventsPage() {
  const { data: events, isLoading, isError } = useQuery<Event[]>({
    queryKey: ['events', 20, 0],
    queryFn: () => listEvents({ limit: 20 })
  });

  if (isLoading) {
    return <p>행사를 불러오는 중입니다…</p>;
  }

  if (isError) {
    return <p className="text-red-600">행사를 불러오지 못했습니다.</p>;
  }

  if (!events || events.length === 0) {
    return <p>등록된 행사가 아직 없습니다.</p>;
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">행사</h2>
      <ul className="space-y-3">
        {events.map((event) => (
          <li key={event.id} className="rounded border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="font-semibold">
              <Link href={`/events/${event.id}`}>{event.title}</Link>
            </h3>
            <p className="mt-1 text-sm text-slate-700">장소: {event.location}</p>
            <p className="mt-1 text-sm text-slate-700">
              일정: {new Date(event.starts_at).toLocaleString()} ~ {new Date(event.ends_at).toLocaleString()}
            </p>
            <p className="mt-2 text-xs text-slate-500">정원: {event.capacity}명</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
