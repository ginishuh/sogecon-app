"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { useState } from 'react';
import { getEvent, type Event, upsertEventRsvp, type RSVPLiteral } from '../../../services/events';
import { getOptionalRsvp, type RSVP } from '../../../services/rsvps';
import { ApiError } from '../../../lib/api';
import { memberApiErrorToMessage } from '../../../lib/error-map';
import { useToast } from '../../../components/toast';
import { useAuth } from '../../../hooks/useAuth';
import { getRsvpExperience } from '../../../lib/member-experience';
import Button from '../../../components/ui/button';

const eventDateTime = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'long',
  timeStyle: 'short',
});

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
    return <p role="status">행사 정보를 불러오는 중…</p>;
  }
  if (eventQuery.isError) {
    return <div role="alert" className="space-y-2 text-state-error"><p>행사 정보를 불러오지 못했습니다.</p><button className="min-h-11 rounded-lg border border-state-error px-4" onClick={() => void eventQuery.refetch()}>다시 불러오기</button></div>;
  }

  const event = eventQuery.data!;

  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <Link href="/events" className="text-link inline-flex min-h-11 items-center">행사 목록으로 돌아가기</Link>
      <header className="space-y-2">
        <p className="text-sm font-semibold text-brand-700">동문 행사</p>
        <h1 className="text-2xl font-semibold">{event.title}</h1>
      </header>
      <dl className="grid gap-3 rounded-xl bg-surface-raised p-4 text-sm text-text-secondary sm:grid-cols-2">
        <div><dt className="font-semibold text-text-primary">일정</dt><dd><time dateTime={event.starts_at}>{eventDateTime.format(new Date(event.starts_at))}</time>부터<br /><time dateTime={event.ends_at}>{eventDateTime.format(new Date(event.ends_at))}</time>까지</dd></div>
        <div><dt className="font-semibold text-text-primary">장소</dt><dd>{event.location || '장소는 추후 안내해 드려요.'}</dd></div>
        <div><dt className="font-semibold text-text-primary">참여 가능 인원</dt><dd>{event.capacity}명</dd></div>
      </dl>

      {event.description && (
        <div className="rounded-md border bg-white p-4 text-sm whitespace-pre-wrap text-text-primary">
          {event.description}
        </div>
      )}

      <RsvpPanel eventId={id} />
    </section>
  );
}

function getMemberId(sessionId: unknown): number | null {
  return typeof sessionId === 'number' ? sessionId : null;
}

function makeRsvpQueryFn(memberId: number | null, eventId: number) {
  return () => {
    if (memberId == null) {
      throw new Error('member_id_missing');
    }
    return getOptionalRsvp(memberId, eventId);
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
    return memberApiErrorToMessage(e.code, e.message);
  }
  return '행사 신청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

function RsvpStatusBlock({
  authStatus,
  isAuthorized,
  rsvp,
  isQueryLoading,
  eventId,
}: {
  authStatus: ReturnType<typeof useAuth>['status'];
  isAuthorized: boolean;
  rsvp: RSVP | null | undefined;
  isQueryLoading: boolean;
  eventId: number;
}) {
  if (authStatus === 'loading') return <p role="status" className="text-sm text-text-muted">로그인 상태를 확인하는 중…</p>;
  if (authStatus === 'error') return <div role="alert" className="space-y-2 text-sm text-state-error"><p>로그인 상태를 확인하지 못했습니다.</p><Button variant="secondary" onClick={() => window.location.reload()}>다시 확인하기</Button></div>;
  if (!isAuthorized) {
    return (
      <p className="text-sm text-text-muted">
        참여 신청은 동문 로그인 후 할 수 있어요.{' '}
        <Link className="text-link inline-flex min-h-11 items-center" href={`/login?next=/events/${eventId}`}>
          동문 로그인
        </Link>
      </p>
    );
  }
  if (isQueryLoading) return <p role="status" className="text-sm text-text-muted">참여 상태를 확인하는 중…</p>;
  const experience = getRsvpExperience(rsvp?.status);
  return <div role="status" className="rounded-lg bg-surface-raised p-3"><p className="font-semibold text-text-primary">{experience.label}</p><p className="mt-1 text-sm text-text-muted">{experience.description}</p></div>;
}

function RsvpActions({
  isAuthorized,
  hasQueryError,
  isQueryLoading,
  rsvp,
  isPending,
  onApply,
  onCancel,
  onRetry,
}: {
  isAuthorized: boolean;
  hasQueryError: boolean;
  isQueryLoading: boolean;
  rsvp: RSVP | null | undefined;
  isPending: boolean;
  onApply: () => void;
  onCancel: () => void;
  onRetry: () => void;
}) {
  if (!isAuthorized) return null;
  if (hasQueryError) {
    return <div role="alert" className="space-y-2 text-sm text-state-error"><p>참여 상태를 확인하지 못했습니다.</p><Button variant="secondary" onClick={onRetry}>다시 확인하기</Button></div>;
  }
  const experience = getRsvpExperience(rsvp?.status);
  return <div className="flex flex-wrap gap-2">{experience.participating ? <Button variant="secondary" loading={isPending} onClick={onCancel}>참여 취소</Button> : <Button loading={isPending || isQueryLoading} onClick={onApply}>참여 신청하기</Button>}</div>;
}

function RsvpFeedback({ message, error }: { message: string | null; error: string | null }) {
  return <>{message ? <p role="status" className="text-state-success text-sm">{message}</p> : null}{error ? <p role="alert" className="text-state-error text-sm">{error}</p> : null}</>;
}

function RsvpPanel({ eventId }: { eventId: number }) {
  const qc = useQueryClient();
  const { show } = useToast();
  const { status: authStatus, data: session } = useAuth();
  const memberId = getMemberId(session?.id);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isAuthorized = authStatus === 'authorized' && memberId != null;

  const rsvpQuery = useQuery<RSVP | null>({
    queryKey: ['rsvp', eventId, memberId],
    queryFn: makeRsvpQueryFn(memberId, eventId),
    enabled: isAuthorized,
    retry: false,
  });

  const mutate = useMutation({
    mutationFn: makeRsvpMutationFn(memberId, eventId),
    onSuccess: async (_data, requestedStatus) => {
      const successMessage = requestedStatus === 'cancel' ? '행사 참여를 취소했습니다.' : '행사 참여 신청이 완료되었습니다.';
      setMessage(successMessage);
      setError(null);
      show(successMessage, { type: 'success' });
      await qc.invalidateQueries({ queryKey: ['rsvp', eventId, memberId] });
    },
    onError: (e: unknown) => {
      const msg = errorToMessage(e);
      setError(msg);
      show(msg, { type: 'error' });
      setMessage(null);
    }
  });

  return (
    <div className="space-y-3 rounded-xl border border-neutral-border p-4">
      <h2 className="font-semibold">참여 신청</h2>
      <RsvpStatusBlock authStatus={authStatus} isAuthorized={isAuthorized} rsvp={rsvpQuery.data} isQueryLoading={rsvpQuery.isLoading} eventId={eventId} />

      <RsvpActions isAuthorized={isAuthorized} hasQueryError={rsvpQuery.isError} isQueryLoading={rsvpQuery.isLoading} rsvp={rsvpQuery.data} isPending={mutate.isPending} onApply={() => mutate.mutate('going')} onCancel={() => mutate.mutate('cancel')} onRetry={() => void rsvpQuery.refetch()} />
      <RsvpFeedback message={message} error={error} />
      <Link href="/support/contact" className="text-link inline-flex min-h-11 items-center text-sm">행사 참여가 어려우신가요? 사무국에 문의하기</Link>
    </div>
  );
}
