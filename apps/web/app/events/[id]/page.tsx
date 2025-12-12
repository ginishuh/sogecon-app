"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { useState } from 'react';
import { getEvent, type Event, upsertEventRsvp, type RSVPLiteral } from '../../../services/events';
import { getRsvp, type RSVP } from '../../../services/rsvps';
import { ApiError } from '../../../lib/api';
import { apiErrorToMessage } from '../../../lib/error-map';
import { useToast } from '../../../components/toast';
import { useAuth } from '../../../hooks/useAuth';

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

      {event.description && (
        <div className="rounded-md border bg-white p-4 text-sm whitespace-pre-wrap text-slate-800">
          {event.description}
        </div>
      )}

      <RsvpPanel eventId={id} />
    </section>
  );
}

function statusToLabel(status: RSVP['status']): string {
  if (status === 'going') return '참석';
  if (status === 'waitlist') return '대기';
  return '취소';
}

function getMemberId(sessionId: unknown): number | null {
  return typeof sessionId === 'number' ? sessionId : null;
}

function makeRsvpQueryFn(memberId: number | null, eventId: number) {
  return () => {
    if (memberId == null) {
      throw new Error('member_id_missing');
    }
    return getRsvp(memberId, eventId);
  };
}

function makeRsvpMutationFn(memberId: number | null, eventId: number) {
  return async (status: RSVPLiteral) => {
    if (memberId == null) {
      throw new Error('member_id_missing');
    }
    await upsertEventRsvp(eventId, memberId, status);
  };
}

function errorToMessage(e: unknown): string {
  if (e instanceof ApiError) {
    return apiErrorToMessage(e.code, e.message);
  }
  return '알 수 없는 오류';
}

function getCurrentStatusText(query: { isSuccess: boolean; isLoading: boolean; data?: RSVP }): string {
  if (query.isSuccess && query.data) {
    return statusToLabel(query.data.status);
  }
  if (query.isLoading) return '조회 중…';
  return '미신청';
}

function RsvpStatusBlock({
  isAuthorized,
  statusText,
  eventId,
}: {
  isAuthorized: boolean;
  statusText: string;
  eventId: number;
}) {
  if (!isAuthorized) {
    return (
      <p className="text-sm text-slate-600">
        참여 신청은 로그인 후 가능합니다.{' '}
        <Link className="underline" href={`/login?next=/events/${eventId}`}>
          로그인하기
        </Link>
      </p>
    );
  }
  return (
    <p className="text-xs text-slate-600">
      현재 상태: {statusText}
    </p>
  );
}

function RsvpPanel({ eventId }: { eventId: number }) {
  const qc = useQueryClient();
  const { show } = useToast();
  const { status: authStatus, data: session } = useAuth();
  const memberId = getMemberId(session?.id);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isAuthorized = authStatus === 'authorized' && memberId != null;

  const rsvpQuery = useQuery<RSVP>({
    queryKey: ['rsvp', eventId, memberId],
    queryFn: makeRsvpQueryFn(memberId, eventId),
    enabled: isAuthorized,
    retry: false,
  });

  const mutate = useMutation({
    mutationFn: makeRsvpMutationFn(memberId, eventId),
    onSuccess: async () => {
      setMessage('참여 신청이 저장되었습니다.');
      setError(null);
      show('참여 신청이 저장되었습니다.', { type: 'success' });
      await qc.invalidateQueries({ queryKey: ['rsvp', eventId, memberId] });
    },
    onError: (e: unknown) => {
      const msg = errorToMessage(e);
      setError(msg);
      show(msg, { type: 'error' });
      setMessage(null);
    }
  });

  const statusText = getCurrentStatusText(rsvpQuery);

  return (
    <div className="rounded-md border p-4 space-y-3">
      <h3 className="font-semibold">참여 신청</h3>
      <RsvpStatusBlock isAuthorized={isAuthorized} statusText={statusText} eventId={eventId} />

      <div className="flex gap-2">
        <button
          className="rounded bg-emerald-600 px-3 py-1 text-white disabled:opacity-50"
          disabled={mutate.isPending || !isAuthorized}
          onClick={() => mutate.mutate('going')}
        >
          참석
        </button>
        <button
          className="rounded bg-amber-600 px-3 py-1 text-white disabled:opacity-50"
          disabled={mutate.isPending || !isAuthorized}
          onClick={() => mutate.mutate('waitlist')}
        >
          대기
        </button>
        <button
          className="rounded bg-slate-600 px-3 py-1 text-white disabled:opacity-50"
          disabled={mutate.isPending || !isAuthorized}
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
