'use client';

import { useEffect, useState } from 'react';
import { listEvents, type Event } from '../../services/events';

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const data = await listEvents({ limit: 20 });
        setEvents(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  if (loading) {
    return <p>행사를 불러오는 중입니다…</p>;
  }

  if (error) {
    return <p className="text-red-600">행사를 불러오지 못했습니다: {error}</p>;
  }

  if (events.length === 0) {
    return <p>등록된 행사가 아직 없습니다.</p>;
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">행사</h2>
      <ul className="space-y-3">
        {events.map((event) => (
          <li key={event.id} className="rounded border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="font-semibold">{event.title}</h3>
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
