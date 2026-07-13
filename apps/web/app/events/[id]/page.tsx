"use client";

import {
  ArrowLeft,
  CalendarBlank,
  CalendarX,
  Clock,
  MapPin,
  Users,
} from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { getEvent, type Event, upsertEventRsvp, type RSVPLiteral } from '../../../services/events';
import { getOptionalRsvp, type RSVP } from '../../../services/rsvps';
import { ApiError } from '../../../lib/api';
import { memberApiErrorToMessage } from '../../../lib/error-map';
import { useToast } from '../../../components/toast';
import { useAuth } from '../../../hooks/useAuth';
import { getRsvpExperience } from '../../../lib/member-experience';
import Button from '../../../components/ui/button';
import ButtonLink from '../../../components/ui/button-link';
import Badge from '../../../components/ui/badge';
import { getEventStatus } from '../../../lib/event-experience';

const eventDateTime = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  dateStyle: 'long',
  timeStyle: 'short',
});

function EventNotFound() {
  return (
    <section className="mx-auto max-w-3xl rounded-2xl border border-neutral-border bg-surface-raised px-5 py-10 text-center sm:px-8" aria-labelledby="event-not-found-title">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-brand-700 ring-1 ring-neutral-border">
        <CalendarX size={29} aria-hidden="true" />
      </span>
      <h1 id="event-not-found-title" className="mt-5 font-heading text-2xl font-semibold text-text-primary sm:text-3xl">행사를 찾지 못했습니다.</h1>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-text-muted">
        종료되었거나 더 이상 공개되지 않는 행사일 수 있어요. 현재 확인할 수 있는 행사로 돌아가 주세요.
      </p>
      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        <ButtonLink href="/events">행사 목록으로</ButtonLink>
        <ButtonLink href="/support/contact" variant="secondary">사무국에 문의하기</ButtonLink>
      </div>
    </section>
  );
}

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const eventQuery = useQuery<Event>({
    queryKey: ['event', id],
    queryFn: () => getEvent(id),
    enabled: Number.isFinite(id),
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status === 404) && failureCount < 1,
  });

  if (!Number.isFinite(id)) {
    return <EventNotFound />;
  }

  if (eventQuery.isLoading) {
    return <p role="status" className="rounded-2xl bg-surface-raised px-5 py-12 text-center text-sm text-text-muted">행사 정보를 불러오는 중…</p>;
  }
  if (eventQuery.isError) {
    if (eventQuery.error instanceof ApiError && eventQuery.error.status === 404) {
      return <EventNotFound />;
    }
    return <div role="alert" className="space-y-3 rounded-2xl bg-state-error-subtle px-5 py-9 text-center text-state-error"><p>행사 정보를 불러오지 못했습니다.</p><Button variant="secondary" onClick={() => void eventQuery.refetch()}>다시 불러오기</Button></div>;
  }

  const event = eventQuery.data!;

  return (
    <article className="mx-auto max-w-4xl space-y-7">
      <Link href="/events" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-text-secondary no-underline hover:bg-brand-50 hover:text-brand-700 hover:no-underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500">
        <ArrowLeft size={19} aria-hidden="true" />행사 목록으로
      </Link>
      <header className="space-y-3 border-b border-neutral-border pb-6">
        <p className="text-sm font-semibold text-brand-700">동문 행사</p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="max-w-3xl font-heading text-3xl font-semibold leading-tight text-text-primary sm:text-4xl">{event.title}</h1>
          <Badge variant={getEventStatus(event).variant}>{getEventStatus(event).label}</Badge>
        </div>
      </header>
      <dl className="grid overflow-hidden rounded-2xl border border-neutral-border bg-surface-raised text-sm text-text-secondary sm:grid-cols-3">
        <div className="flex gap-3 border-b border-neutral-border p-5 sm:border-b-0 sm:border-r">
          <CalendarBlank className="shrink-0 text-brand-700" size={23} aria-hidden="true" />
          <div><dt className="font-semibold text-text-primary">일정</dt><dd className="mt-1 leading-6"><time dateTime={event.starts_at}>{eventDateTime.format(new Date(event.starts_at))}</time>부터<br /><time dateTime={event.ends_at}>{eventDateTime.format(new Date(event.ends_at))}</time>까지</dd></div>
        </div>
        <div className="flex gap-3 border-b border-neutral-border p-5 sm:border-b-0 sm:border-r">
          <MapPin className="shrink-0 text-brand-700" size={23} aria-hidden="true" />
          <div><dt className="font-semibold text-text-primary">장소</dt><dd className="mt-1 leading-6">{event.location || '장소는 추후 안내해 드려요.'}</dd></div>
        </div>
        <div className="flex gap-3 p-5">
          <Users className="shrink-0 text-brand-700" size={23} aria-hidden="true" />
          <div><dt className="font-semibold text-text-primary">참여 가능 인원</dt><dd className="mt-1 leading-6">정원 {event.capacity}명</dd></div>
        </div>
      </dl>

      {event.description && (
        <section aria-labelledby="event-description-title" className="border-b border-neutral-border pb-7">
          <h2 id="event-description-title" className="font-heading text-xl font-semibold text-text-primary">행사 안내</h2>
          <div className="mt-3 max-w-3xl whitespace-pre-wrap text-base leading-7 text-text-primary">{event.description}</div>
        </section>
      )}

      <RsvpPanel eventId={id} />
    </article>
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
    <section className="space-y-4 rounded-2xl border border-neutral-border bg-white p-5 sm:p-6" aria-labelledby="event-rsvp-title">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-700"><Clock size={23} aria-hidden="true" /></span>
        <div><h2 id="event-rsvp-title" className="font-heading text-xl font-semibold text-text-primary">참여 신청</h2><p className="mt-0.5 text-sm text-text-muted">현재 참여 상태를 확인하고 신청을 이어가세요.</p></div>
      </div>
      <RsvpStatusBlock authStatus={authStatus} isAuthorized={isAuthorized} rsvp={rsvpQuery.data} isQueryLoading={rsvpQuery.isLoading} eventId={eventId} />

      <RsvpActions isAuthorized={isAuthorized} hasQueryError={rsvpQuery.isError} isQueryLoading={rsvpQuery.isLoading} rsvp={rsvpQuery.data} isPending={mutate.isPending} onApply={() => mutate.mutate('going')} onCancel={() => mutate.mutate('cancel')} onRetry={() => void rsvpQuery.refetch()} />
      <RsvpFeedback message={message} error={error} />
      <Link href="/support/contact" className="text-link inline-flex min-h-11 items-center text-sm">행사 참여가 어려우신가요? 사무국에 문의하기</Link>
    </section>
  );
}
