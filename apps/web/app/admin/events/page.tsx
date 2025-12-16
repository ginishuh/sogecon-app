"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { ConfirmDialog } from '../../../components/confirm-dialog';
import { HeroTargetToggle } from '../../../components/hero-target-toggle';
import { RequireAdmin } from '../../../components/require-admin';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../components/toast';
import { useHeroTargetControls } from '../../../hooks/useHeroTargetControls';
import {
  deleteAdminEvent,
  listAdminEvents,
  type AdminEventListResponse,
  type AdminEventListParams,
} from '../../../services/events';
import type { HeroTargetLookupItem } from '../../../services/hero';

const PAGE_SIZE = 20;

type StatusFilter = 'all' | NonNullable<AdminEventListParams['status']>;

function toIsoStart(date: string) {
  return `${date}T00:00:00Z`;
}

function toIsoEnd(date: string) {
  return `${date}T23:59:59Z`;
}

function buildListParams(
  page: number,
  query: string,
  statusFilter: StatusFilter,
  dateFrom: string,
  dateTo: string
): AdminEventListParams {
  const offset = page * PAGE_SIZE;
  return {
    limit: PAGE_SIZE,
    offset,
    q: query.trim() || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
    date_from: dateFrom ? toIsoStart(dateFrom) : undefined,
    date_to: dateTo ? toIsoEnd(dateTo) : undefined,
  };
}

function FiltersBar({
  query,
  status,
  dateFrom,
  dateTo,
  onChangeQuery,
  onChangeStatus,
  onChangeDateFrom,
  onChangeDateTo,
  onClear,
}: {
  query: string;
  status: StatusFilter;
  dateFrom: string;
  dateTo: string;
  onChangeQuery: (v: string) => void;
  onChangeStatus: (v: StatusFilter) => void;
  onChangeDateFrom: (v: string) => void;
  onChangeDateTo: (v: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded border border-slate-200 bg-white p-3 md:flex-row md:items-end md:gap-4">
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        제목 검색
        <input
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="행사 제목"
          value={query}
          onChange={(e) => onChangeQuery(e.currentTarget.value)}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-slate-600">
        상태
        <select
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          value={status}
          onChange={(e) => onChangeStatus(e.currentTarget.value as StatusFilter)}
        >
          <option value="all">전체</option>
          <option value="upcoming">예정</option>
          <option value="ongoing">진행 중</option>
          <option value="ended">종료</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-slate-600">
        시작일(이후)
        <input
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          type="date"
          value={dateFrom}
          onChange={(e) => onChangeDateFrom(e.currentTarget.value)}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-slate-600">
        종료일(이전)
        <input
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          type="date"
          value={dateTo}
          onChange={(e) => onChangeDateTo(e.currentTarget.value)}
        />
      </label>

      <button
        type="button"
        className="self-start rounded border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 md:self-auto"
        onClick={onClear}
      >
        초기화
      </button>
    </div>
  );
}

function formatRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  const startStr = start.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const endStr = end.toLocaleString('ko-KR', {
    month: sameDay ? undefined : '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return sameDay ? `${startStr} ~ ${endStr}` : `${startStr} ~ ${endStr}`;
}

function StatusBadge({ startsAt, endsAt }: { startsAt: string; endsAt: string }) {
  const now = Date.now();
  const startMs = new Date(startsAt).getTime();
  const endMs = new Date(endsAt).getTime();

  if (endMs < now) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
        종료
      </span>
    );
  }
  if (startMs <= now && endMs >= now) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
        진행 중
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-200">
      예정
    </span>
  );
}

type EventRow = AdminEventListResponse['items'][number];

function EventTable({
  items,
  isLoading,
  isError,
  heroById,
  heroPending,
  onToggleHeroFor,
  onTogglePinnedFor,
  onDelete,
}: {
  items: EventRow[];
  isLoading: boolean;
  isError: boolean;
  heroById: Map<number, HeroTargetLookupItem>;
  heroPending: boolean;
  onToggleHeroFor: (event: EventRow, nextOn: boolean) => void;
  onTogglePinnedFor: (event: EventRow, nextPinned: boolean) => void;
  onDelete: (event: EventRow) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b bg-slate-50">
            <th className="px-3 py-2 font-medium text-slate-700">제목 / 일정</th>
            <th className="px-3 py-2 font-medium text-slate-700">장소</th>
            <th className="px-3 py-2 font-medium text-slate-700">정원</th>
            <th className="px-3 py-2 font-medium text-slate-700">참여 현황</th>
            <th className="px-3 py-2 font-medium text-slate-700">상태</th>
            <th className="px-3 py-2 font-medium text-slate-700">홈 배너</th>
            <th className="px-3 py-2 font-medium text-slate-700 text-right">액션</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                로딩 중...
              </td>
            </tr>
          ) : isError ? (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-red-600">
                데이터를 불러올 수 없습니다.
              </td>
            </tr>
          ) : items.length > 0 ? (
            items.map((evt) => (
              <tr key={evt.id} className="border-b hover:bg-slate-50">
                <td className="px-3 py-2">
                  <div className="flex flex-col">
                    <Link
                      href={`/events/${evt.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {evt.title}
                    </Link>
                    <span className="text-xs text-slate-500">
                      {formatRange(evt.starts_at, evt.ends_at)}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-slate-700">{evt.location}</td>
                <td className="px-3 py-2 text-slate-700">{evt.capacity}</td>
                <td className="px-3 py-2">
                  <div className="text-xs text-slate-600">
                    참석 {evt.rsvp_counts.going} · 대기 {evt.rsvp_counts.waitlist} · 취소{' '}
                    {evt.rsvp_counts.cancel}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <StatusBadge startsAt={evt.starts_at} endsAt={evt.ends_at} />
                </td>
                <td className="px-3 py-2">
                  <HeroTargetToggle
                    value={heroById.get(evt.id)}
                    isPending={heroPending}
                    onToggle={(nextOn) => onToggleHeroFor(evt, nextOn)}
                    onTogglePinned={(nextPinned) => onTogglePinnedFor(evt, nextPinned)}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/admin/events/${evt.id}/edit`}
                    className="text-sm text-slate-600 hover:text-slate-900"
                  >
                    수정
                  </Link>
                  <span className="mx-1 text-slate-300">|</span>
                  <button
                    type="button"
                    className="text-sm text-red-600 hover:text-red-700"
                    onClick={() => onDelete(evt)}
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                등록된 행사가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  total,
  isFetching,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  total: number;
  isFetching: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mt-4 flex items-center justify-between">
      <div className="text-xs text-slate-500">
        {isFetching ? '갱신 중...' : `페이지 ${page + 1} / ${totalPages} · 총 ${total}건`}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          disabled={page === 0 || isFetching}
          onClick={onPrev}
        >
          이전
        </button>
        <button
          type="button"
          className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          disabled={page >= totalPages - 1 || isFetching}
          onClick={onNext}
        >
          다음
        </button>
      </div>
    </div>
  );
}

export default function AdminEventsPage() {
  const { status } = useAuth();
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<EventRow | null>(null);
  const { show } = useToast();
  const queryClient = useQueryClient();

  const listParams = buildListParams(page, query, statusFilter, dateFrom, dateTo);

  const { data, isLoading, isError, isFetching } = useQuery<AdminEventListResponse>({
    queryKey: ['admin-events', page, listParams.q, listParams.status, dateFrom, dateTo],
    queryFn: () => listAdminEvents(listParams),
    staleTime: 10_000,
  });

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const eventIds = useMemo(() => items.map((evt) => evt.id), [items]);
  const heroControls = useHeroTargetControls({ targetType: 'event', targetIds: eventIds, showToast: show });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAdminEvent(id),
    onSuccess: () => {
      show('행사가 삭제되었습니다.', { type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      setDeleteTarget(null);
    },
    onError: () => {
      show('삭제 중 오류가 발생했습니다.', { type: 'error' });
    },
  });

  if (status !== 'authorized') {
    return <div className="p-6 text-sm text-slate-600">관리자 로그인이 필요합니다.</div>;
  }

  return (
    <RequireAdmin fallback={<div className="p-6 text-sm text-slate-600">관리자 전용입니다.</div>}>
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">행사 관리</h2>
            <p className="text-sm text-slate-600">
              생성한 행사 목록을 확인합니다. 홈 배너는 목록의 “홈 배너” 토글로 지정합니다.
            </p>
          </div>
          <Link
            href="/admin/events/new"
            className="rounded bg-brand-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-primaryDark active:bg-brand-primaryDark hover:text-white active:text-white visited:text-white hover:no-underline active:no-underline"
          >
            + 새 행사 생성
          </Link>
        </div>

        <FiltersBar
          query={query}
          status={statusFilter}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onChangeQuery={(v) => {
            setQuery(v);
            setPage(0);
          }}
          onChangeStatus={(v) => {
            setStatusFilter(v);
            setPage(0);
          }}
          onChangeDateFrom={(v) => {
            setDateFrom(v);
            setPage(0);
          }}
          onChangeDateTo={(v) => {
            setDateTo(v);
            setPage(0);
          }}
          onClear={() => {
            setQuery('');
            setStatusFilter('all');
            setDateFrom('');
            setDateTo('');
            setPage(0);
          }}
        />

        <EventTable
          items={items}
          isLoading={isLoading}
          isError={isError}
          heroById={heroControls.heroById}
          heroPending={heroControls.isPending}
          onToggleHeroFor={(evt, nextOn) => heroControls.toggleHero(evt.id, nextOn)}
          onTogglePinnedFor={(evt, nextPinned) => heroControls.togglePinned(evt.id, nextPinned)}
          onDelete={(evt) => setDeleteTarget(evt)}
        />

        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          isFetching={isFetching}
          onPrev={() => setPage((p) => Math.max(0, p - 1))}
          onNext={() => setPage((p) => p + 1)}
        />
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="행사 삭제"
        description={`"${deleteTarget?.title}" 행사를 삭제하시겠습니까?\n관련 참여 신청 기록도 함께 삭제됩니다.`}
        confirmLabel="삭제"
        variant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </RequireAdmin>
  );
}
