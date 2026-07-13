'use client';

import {
  ArrowRight,
  Bell,
  CalendarBlank,
  Clock,
  MapPin,
  Users,
} from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import type { Route } from 'next';
import { useMemo, useState } from 'react';

import Badge from '../../components/ui/badge';
import Button from '../../components/ui/button';
import ButtonLink from '../../components/ui/button-link';
import {
  getEventStatus,
  loadAllEvents,
  selectEvents,
  type EventListView,
} from '../../lib/event-experience';
import { listEvents, type Event } from '../../services/events';

const dateParts = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
});

const monthDay = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: 'numeric',
  day: 'numeric',
});

const weekday = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  weekday: 'long',
});

const eventYear = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
});

const eventTime = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function EventFilters({ view, onChange }: { view: EventListView; onChange: (view: EventListView) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="행사 시기">
      {([
        ['upcoming', '예정된 행사'],
        ['past', '지난 행사'],
      ] as const).map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={view === value}
          onClick={() => onChange(value)}
          className={`min-h-11 rounded-full px-5 text-sm font-semibold transition focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
            view === value
              ? 'bg-brand-700 text-text-inverse'
              : 'border border-neutral-border bg-white text-text-primary hover:bg-brand-50'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function EventDateBlock({ event, compact = false }: { event: Event; compact?: boolean }) {
  const startsAt = new Date(event.starts_at);
  const [month, day] = monthDay.format(startsAt).replaceAll(' ', '').split('.').filter(Boolean);

  if (compact) {
    return (
      <div className="min-w-0 text-sm text-text-secondary lg:text-base">
        <p className="font-medium text-text-primary">{dateParts.format(startsAt)}</p>
        <p className="mt-1">{eventTime.format(startsAt)}–{eventTime.format(new Date(event.ends_at))}</p>
      </div>
    );
  }

  return (
    <div className="flex w-full shrink-0 items-center gap-4 border-b border-neutral-border pb-4 sm:w-auto sm:min-w-40 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-6 lg:min-w-48 lg:justify-center">
      <div className="text-center">
        <span className="block text-xs font-semibold text-brand-700">{eventYear.format(startsAt)}</span>
        <strong className="mt-1 block font-heading text-5xl font-semibold leading-none text-brand-700 lg:text-6xl">
          {month}.{day}
        </strong>
        <span className="mt-2 block text-sm font-medium text-brand-700">{weekday.format(startsAt)}</span>
      </div>
    </div>
  );
}

function EventFacts({ event }: { event: Event }) {
  return (
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-text-secondary">
      <span className="inline-flex items-center gap-1.5">
        <Clock size={19} aria-hidden="true" />
        {eventTime.format(new Date(event.starts_at))}–{eventTime.format(new Date(event.ends_at))}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <MapPin size={19} aria-hidden="true" />
        {event.location || '장소는 추후 안내해 드려요.'}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Users size={19} aria-hidden="true" />
        정원 {event.capacity}명
      </span>
    </div>
  );
}

function FeaturedEvent({ event }: { event: Event }) {
  const status = getEventStatus(event);
  return (
    <article className="grid gap-5 rounded-2xl border border-neutral-border bg-surface-raised p-5 shadow-xs sm:flex sm:items-stretch sm:p-6 lg:gap-8 lg:p-7">
      <EventDateBlock event={event} />
      <div className="min-w-0 flex-1 sm:py-1">
        <Badge variant={status.variant}>{status.label}</Badge>
        <h2 className="mt-3 font-heading text-2xl font-semibold leading-tight text-text-primary lg:text-3xl">
          {event.title}
        </h2>
        <EventFacts event={event} />
      </div>
      <div className="flex items-end sm:shrink-0 sm:justify-end sm:py-1">
        <ButtonLink href={`/events/${event.id}` as Route} className="w-full gap-2 sm:w-auto">
          행사 자세히 보기
          <ArrowRight size={19} weight="bold" aria-hidden="true" />
        </ButtonLink>
      </div>
    </article>
  );
}

function EventRow({ event }: { event: Event }) {
  const status = getEventStatus(event);
  return (
    <article className="grid gap-4 border-t border-neutral-border px-4 py-5 first:border-t-0 sm:px-5 lg:grid-cols-[15rem_minmax(0,1fr)_9rem_7rem_8rem] lg:items-center lg:gap-5 lg:px-6">
      <EventDateBlock event={event} compact />
      <div className="min-w-0">
        <h3 className="text-base font-semibold leading-6 text-text-primary lg:text-lg">{event.title}</h3>
        <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-text-muted">
          <MapPin size={18} aria-hidden="true" />
          {event.location || '장소는 추후 안내해 드려요.'}
        </p>
      </div>
      <p className="inline-flex items-center gap-1.5 text-sm text-text-secondary">
        <Users size={18} aria-hidden="true" />정원 {event.capacity}명
      </p>
      <div><Badge variant={status.variant}>{status.label}</Badge></div>
      <ButtonLink href={`/events/${event.id}` as Route} variant="secondary" size="sm" className="w-full gap-1.5 lg:w-auto">
        자세히 보기
        <ArrowRight size={17} aria-hidden="true" />
      </ButtonLink>
    </article>
  );
}

function EventsEmptyState({ view, onShowUpcoming }: { view: EventListView; onShowUpcoming: () => void }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-neutral-border bg-surface-raised px-5 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-7" aria-labelledby="events-empty-title">
      <div className="flex min-w-0 items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-brand-700 ring-1 ring-neutral-border">
          {view === 'upcoming' ? <Bell size={25} aria-hidden="true" /> : <CalendarBlank size={25} aria-hidden="true" />}
        </span>
        <div>
          <h2 id="events-empty-title" className="font-semibold text-text-primary">
            {view === 'upcoming' ? '등록된 예정 행사가 없습니다.' : '지난 행사가 아직 없습니다.'}
          </h2>
          <p className="mt-1 text-sm leading-6 text-text-muted">
            {view === 'upcoming'
              ? '새 행사가 열리면 알림으로 안내해 드릴게요.'
              : '새로운 행사 소식은 예정된 행사에서 확인해 주세요.'}
          </p>
        </div>
      </div>
      {view === 'upcoming' ? (
        <ButtonLink href="/faq" variant="secondary" size="sm" className="shrink-0">알림 이용 안내</ButtonLink>
      ) : (
        <Button variant="secondary" size="sm" className="shrink-0" onClick={onShowUpcoming}>예정된 행사 보기</Button>
      )}
    </section>
  );
}

function EventUpdatesPrompt() {
  return (
    <aside className="flex flex-col gap-4 rounded-2xl border border-neutral-border bg-surface-raised px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-7" aria-label="행사 알림 안내">
      <div className="flex min-w-0 items-center gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-brand-700 ring-1 ring-neutral-border"><Bell size={23} aria-hidden="true" /></span>
        <div><p className="font-semibold text-text-primary">새 행사 소식을 놓치지 마세요.</p><p className="mt-1 text-sm leading-6 text-text-muted">알림 이용 방법을 확인하고 동문회 소식을 빠르게 받아보세요.</p></div>
      </div>
      <ButtonLink href="/faq" variant="secondary" size="sm" className="shrink-0">알림 이용 안내</ButtonLink>
    </aside>
  );
}

export default function EventsPage() {
  const [view, setView] = useState<EventListView>('upcoming');
  const query = useQuery<Event[]>({
    queryKey: ['events', 'all'],
    queryFn: () => loadAllEvents(listEvents),
  });

  const selectedEvents = useMemo(
    () => selectEvents(query.data ?? [], view),
    [query.data, view],
  );
  const featuredEvent = selectedEvents[0];
  const laterEvents = selectedEvents.slice(1);

  return (
    <div className="space-y-6 lg:space-y-7">
      <header className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-brand-700">행사 일정</p>
          <h1 className="font-heading text-3xl font-semibold leading-tight text-text-primary lg:text-4xl">
            {view === 'past' ? '지난 행사' : '다가오는 행사'}
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">
            {view === 'past'
              ? '함께했던 서강 경제 동문 행사의 기록을 확인하세요.'
              : '서강 경제 동문을 위한 모임과 강연, 네트워킹 행사를 확인하세요.'}
          </p>
        </div>
        <EventFilters view={view} onChange={setView} />
      </header>

      {query.isLoading ? (
        <p className="rounded-2xl bg-surface-raised px-5 py-12 text-center text-sm text-text-secondary" role="status">행사를 불러오는 중입니다…</p>
      ) : query.isError ? (
        <div role="alert" className="space-y-3 rounded-2xl bg-state-error-subtle px-5 py-9 text-center text-state-error">
          <p>행사를 불러오지 못했습니다.</p>
          <Button variant="secondary" onClick={() => void query.refetch()}>다시 불러오기</Button>
        </div>
      ) : featuredEvent == null ? (
        <EventsEmptyState view={view} onShowUpcoming={() => setView('upcoming')} />
      ) : (
        <div className="space-y-5">
          <FeaturedEvent event={featuredEvent} />
          {laterEvents.length > 0 ? (
            <section className="overflow-hidden rounded-2xl border border-neutral-border bg-white" aria-labelledby="more-events-title">
              <h2 id="more-events-title" className="sr-only">
                {view === 'past' ? '최근 지난 행사' : '이어서 열리는 행사'}
              </h2>
              <div className="hidden border-b border-neutral-border bg-surface-raised px-6 py-3 text-xs font-medium text-text-muted lg:grid lg:grid-cols-[15rem_minmax(0,1fr)_9rem_7rem_8rem] lg:gap-5">
                <span>일시</span><span>행사 정보</span><span>정원</span><span>상태</span><span>보기</span>
              </div>
              {laterEvents.map((event) => <EventRow key={event.id} event={event} />)}
            </section>
          ) : null}
        </div>
      )}

      {selectedEvents.length > 0 ? <EventUpdatesPrompt /> : null}
    </div>
  );
}
