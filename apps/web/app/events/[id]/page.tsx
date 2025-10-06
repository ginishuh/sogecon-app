"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notFound, useParams } from 'next/navigation';
import { useState } from 'react';
import { getEvent, type Event, upsertEventRsvp, type RSVPLiteral } from '../../../services/events';
import { getRsvp, type RSVP } from '../../../services/rsvps';
import { ApiError } from '../../../lib/api';
import { apiErrorToMessage } from '../../../lib/error-map';
import { useToast } from '../../../components/toast';

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const eventQuery = useQuery<Event>({
    queryKey: ['event', id],
    queryFn: () => getEvent(id),
    enabled: Number.isFinite(id)
  });

  if (!Number.isFinite(id)) {
    return notFound();
  }

  if (eventQuery.isLoading) {
    return <p>행사 정보를 불러오는 중…</p>;
  }
  if (eventQuery.isError) {
    return <p className="text-red-600">행사 정보를 불러오지 못했습니다.</p>;
  }

  const event = eventQuery.data!;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">{event.title}</h2>
      <div className="text-sm text-slate-700 space-y-1">
        <p>장소: {event.location}</p>
        <p>
          일정: {new Date(event.starts_at).toLocaleString()} ~ {new Date(event.ends_at).toLocaleString()}
        </p>
        <p>정원: {event.capacity}명</p>
      </div>

      <RsvpPanel eventId={id} />
    </section>
  );
}

function RsvpPanel({ eventId }: { eventId: number }) {
  const qc = useQueryClient();
  const { show } = useToast();
  const [memberId, setMemberId] = useState<number | ''>('' as const);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rsvpQuery = useQuery<RSVP>({
    queryKey: ['rsvp', eventId, memberId],
    queryFn: () => getRsvp(Number(memberId), eventId),
    enabled: typeof memberId === 'number'
  });

  const mutate = useMutation({
    mutationFn: (status: RSVPLiteral) => upsertEventRsvp(eventId, Number(memberId), status),
    onSuccess: async () => {
      setMessage('RSVP가 저장되었습니다.');
      setError(null);
      show('RSVP가 저장되었습니다.', { type: 'success' });
      await qc.invalidateQueries({ queryKey: ['rsvp', eventId, memberId] });
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError) {
        const msg = apiErrorToMessage(e.code, e.message);
        setError(msg);
        show(msg, { type: 'error' });
      } else {
        setError('알 수 없는 오류');
        show('알 수 없는 오류', { type: 'error' });
      }
      setMessage(null);
    }
  });

  return (
    <div className="rounded-md border p-4 space-y-3">
      <h3 className="font-semibold">RSVP</h3>
      <label className="block text-sm">
        회원 ID
        <input
          className="mt-1 w-40 rounded border px-2 py-1"
          type="number"
          inputMode="numeric"
          value={memberId}
          onChange={(e) => setMemberId(e.currentTarget.value === '' ? '' : Number(e.currentTarget.value))}
        />
      </label>

      {typeof memberId === 'number' && (
        <p className="text-xs text-slate-600">
          현재 상태: {rsvpQuery.isSuccess ? rsvpQuery.data.status : rsvpQuery.isLoading ? '조회 중…' : '없음'}
        </p>
      )}

      <div className="flex gap-2">
        <button
          className="rounded bg-emerald-600 px-3 py-1 text-white disabled:opacity-50"
          disabled={mutate.isPending || typeof memberId !== 'number'}
          onClick={() => mutate.mutate('going')}
        >
          참석
        </button>
        <button
          className="rounded bg-amber-600 px-3 py-1 text-white disabled:opacity-50"
          disabled={mutate.isPending || typeof memberId !== 'number'}
          onClick={() => mutate.mutate('waitlist')}
        >
          대기
        </button>
        <button
          className="rounded bg-slate-600 px-3 py-1 text-white disabled:opacity-50"
          disabled={mutate.isPending || typeof memberId !== 'number'}
          onClick={() => mutate.mutate('cancel')}
        >
          취소
        </button>
      </div>

      {message && <p className="text-emerald-700 text-sm">{message}</p>}
      {error && <p className="text-red-700 text-sm">{error}</p>}
    </div>
  );
}
