"use client";

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createEvent } from '../../../services/events';
import { ApiError } from '../../../lib/api';
import { apiErrorToMessage } from '../../../lib/error-map';

export default function NewEventPage() {
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState<number | ''>('' as const);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const mutate = useMutation({
    mutationFn: () =>
      createEvent({
        title,
        location,
        capacity: Number(capacity),
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString()
      }),
    onSuccess: () => {
      router.push(`/events`);
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError) setError(apiErrorToMessage(e.code, e.message));
      else setError('알 수 없는 오류');
    }
  });

  const disabled =
    mutate.isPending || !title || !location || typeof capacity !== 'number' || !startsAt || !endsAt;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">행사 생성</h2>
      <div className="space-y-3">
        <label className="block text-sm">
          제목
          <input className="mt-1 w-full rounded border px-2 py-1" value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
        </label>
        <label className="block text-sm">
          장소
          <input className="mt-1 w-full rounded border px-2 py-1" value={location} onChange={(e) => setLocation(e.currentTarget.value)} />
        </label>
        <label className="block text-sm">
          정원
          <input
            className="mt-1 w-40 rounded border px-2 py-1"
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(e.currentTarget.value === '' ? '' : Number(e.currentTarget.value))}
          />
        </label>
        <label className="block text-sm">
          시작 일시
          <input className="mt-1 rounded border px-2 py-1" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.currentTarget.value)} />
        </label>
        <label className="block text-sm">
          종료 일시
          <input className="mt-1 rounded border px-2 py-1" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.currentTarget.value)} />
        </label>
        <button className="rounded bg-slate-900 px-3 py-1 text-white disabled:opacity-50" disabled={disabled} onClick={() => mutate.mutate()}>
          생성
        </button>
        {error && <p className="text-red-700 text-sm">{error}</p>}
      </div>
    </section>
  );
}

