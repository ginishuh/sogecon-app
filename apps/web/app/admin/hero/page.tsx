"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { ConfirmDialog } from '../../../components/confirm-dialog';
import { RequireAdmin } from '../../../components/require-admin';
import { useToast } from '../../../components/toast';
import { ApiError } from '../../../lib/api';
import { apiErrorToMessage } from '../../../lib/error-map';
import {
  deleteAdminHeroItem,
  listAdminHeroItems,
  updateAdminHeroItem,
  type HeroItem,
} from '../../../services/hero';

const PAGE_SIZE = 50;

function targetLabel(item: HeroItem): string {
  if (item.target_type === 'event') return `행사 #${item.target_id}`;
  return `게시글 #${item.target_id}`;
}

function targetHref(item: HeroItem): string {
  if (item.target_type === 'event') return `/events/${item.target_id}`;
  return `/posts/${item.target_id}`;
}

function shouldShowEmptyState(
  isLoading: boolean,
  isError: boolean,
  itemsLength: number
): boolean {
  if (isLoading) return false;
  if (isError) return false;
  return itemsLength === 0;
}

function buildDeleteDescription(target: HeroItem | null): string {
  if (!target) return '';
  return `"${targetLabel(target)}" 배너를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`;
}

export default function AdminHeroPage() {
  const queryClient = useQueryClient();
  const { show } = useToast();
  const [page, setPage] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<HeroItem | null>(null);

  const query = useQuery({
    queryKey: ['admin-hero', page],
    queryFn: () => listAdminHeroItems({ limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    retry: false,
  });

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const total = query.data?.total ?? 0;
  const hasMore = (page + 1) * PAGE_SIZE < total;
  const hasItems = items.length > 0;
  const showEmpty = shouldShowEmptyState(query.isLoading, query.isError, items.length);
  const deleteDescription = buildDeleteDescription(deleteTarget);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAdminHeroItem(id),
    onSuccess: () => {
      show('배너가 삭제되었습니다.', { type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['admin-hero'] });
      setDeleteTarget(null);
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError) {
        show(apiErrorToMessage(e.code, e.message), { type: 'error' });
      } else {
        show('삭제 중 오류가 발생했습니다.', { type: 'error' });
      }
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (params: { id: number; enabled?: boolean; pinned?: boolean }) =>
      updateAdminHeroItem(params.id, {
        enabled: params.enabled,
        pinned: params.pinned,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-hero'] });
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError) {
        show(apiErrorToMessage(e.code, e.message), { type: 'error' });
      } else {
        show('저장 중 오류가 발생했습니다.', { type: 'error' });
      }
    },
  });

  return (
    <RequireAdmin fallback={<div className="p-6 text-sm text-slate-600">관리자 전용입니다.</div>}>
      <section className="mx-auto max-w-4xl space-y-4 p-6">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold">홈 배너(히어로) 관리</h1>
          <p className="text-sm text-slate-600">
            배너 지정/해제는 “게시물 관리”, “행사 관리”에서 하고, 여기서는 오버라이드/삭제를 관리합니다.
          </p>
        </header>

        <p hidden={!query.isLoading} className="text-sm text-slate-600">
          불러오는 중…
        </p>
        <p hidden={!query.isError} className="text-sm text-red-600">
          목록을 불러오지 못했습니다.
        </p>

        <div hidden={!showEmpty} className="rounded border border-slate-200 bg-white p-6 text-sm text-slate-600">
          등록된 배너가 없습니다. 게시물/행사 관리에서 배너를 켜주세요.
        </div>

        <ul hidden={!hasItems} className="divide-y rounded border border-slate-200 bg-white">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-slate-900">{targetLabel(item)}</span>
                  <a
                    href={targetHref(item)}
                    className="text-xs text-slate-600 underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    미리보기
                  </a>
                  {!item.enabled ? (
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">비노출</span>
                  ) : null}
                  {item.pinned ? (
                    <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700">PIN</span>
                  ) : null}
                </div>
                <div className="text-xs text-slate-500">
                  {item.title_override ? '제목 오버라이드' : '제목: 대상 값 사용'} ·{' '}
                  {item.description_override ? '설명 오버라이드' : '설명: 대상 값 사용'} ·{' '}
                  {item.image_override ? '이미지 오버라이드' : '이미지: 대상/기본값'}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={(e) => toggleMutation.mutate({ id: item.id, enabled: e.currentTarget.checked })}
                    disabled={toggleMutation.isPending}
                    className="rounded border-slate-300"
                  />
                  노출
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={item.pinned}
                    onChange={(e) => toggleMutation.mutate({ id: item.id, pinned: e.currentTarget.checked })}
                    disabled={toggleMutation.isPending}
                    className="rounded border-slate-300"
                  />
                  PIN
                </label>
                <Link
                  href={`/admin/hero/${item.id}/edit`}
                  className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  수정
                </Link>
                <button
                  type="button"
                  className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                  onClick={() => setDeleteTarget(item)}
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div hidden={!hasItems} className="flex justify-between pt-2">
          <button
            type="button"
            className="rounded border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || query.isLoading}
          >
            이전
          </button>
          <button
            type="button"
            className="rounded border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasMore || query.isLoading}
          >
            다음
          </button>
        </div>

        <ConfirmDialog
          open={deleteTarget != null}
          title="배너 삭제"
          description={deleteDescription}
          confirmLabel="삭제"
          variant="danger"
          isPending={deleteMutation.isPending}
          onConfirm={() => {
            if (!deleteTarget) return;
            deleteMutation.mutate(deleteTarget.id);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      </section>
    </RequireAdmin>
  );
}
