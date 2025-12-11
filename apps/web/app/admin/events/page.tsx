"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { ConfirmDialog } from '../../../components/confirm-dialog';
import { RequireAdmin } from '../../../components/require-admin';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../components/toast';
import {
  deleteAdminEvent,
  listAdminEvents,
  type AdminEventListResponse,
} from '../../../services/events';

const PAGE_SIZE = 20;

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
  onDelete,
}: {
  items: EventRow[];
  isLoading: boolean;
  isError: boolean;
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
            <th className="px-3 py-2 font-medium text-slate-700">상태</th>
            <th className="px-3 py-2 font-medium text-slate-700 text-right">액션</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                로딩 중...
              </td>
            </tr>
          ) : isError ? (
            <tr>
              <td colSpan={5} className="px-3 py-8 text-center text-red-600">
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
                  <StatusBadge startsAt={evt.starts_at} endsAt={evt.ends_at} />
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/events/${evt.id}`}
                    className="text-sm text-slate-600 hover:text-slate-900"
                  >
                    보기
                  </Link>
                  <span className="mx-1 text-slate-300">|</span>
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
              <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
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
  const offset = page * PAGE_SIZE;
  const [deleteTarget, setDeleteTarget] = useState<EventRow | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, isFetching } = useQuery<AdminEventListResponse>({
    queryKey: ['admin-events', page],
    queryFn: () => listAdminEvents({ limit: PAGE_SIZE, offset }),
    staleTime: 10_000,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAdminEvent(id),
    onSuccess: () => {
      toast.show('행사가 삭제되었습니다.', { type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      setDeleteTarget(null);
    },
    onError: () => {
      toast.show('삭제 중 오류가 발생했습니다.', { type: 'error' });
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
            <p className="text-sm text-slate-600">생성한 행사 목록을 확인합니다.</p>
          </div>
          <Link
            href="/events/new"
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            + 새 행사 생성
          </Link>
        </div>

        <EventTable
          items={items}
          isLoading={isLoading}
          isError={isError}
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
