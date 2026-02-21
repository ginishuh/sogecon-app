"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { RequirePermission } from '../../../components/require-permission';
import { useToast } from '../../../components/toast';
import { useAuth } from '../../../hooks/useAuth';
import { ApiError } from '../../../lib/api';
import { apiErrorToMessage } from '../../../lib/error-map';
import {
  approveProfileChangeRequest,
  listProfileChangeRequests,
  rejectProfileChangeRequest,
  type ProfileChangeRequestRead,
  type ProfileChangeRequestStatus,
} from '../../../services/profile-change-requests';

const PAGE_SIZE = 20;

const STATUS_OPTIONS: Array<{ value: ProfileChangeRequestStatus | 'all'; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'pending', label: '대기' },
  { value: 'approved', label: '승인' },
  { value: 'rejected', label: '반려' },
];

const STATUS_BADGES: Record<string, { text: string; className: string }> = {
  pending: { text: '대기', className: 'bg-amber-100 text-amber-800' },
  approved: { text: '승인', className: 'bg-green-100 text-green-800' },
  rejected: { text: '반려', className: 'bg-red-100 text-red-800' },
};

const FIELD_LABELS: Record<string, string> = {
  name: '이름',
  cohort: '기수',
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_BADGES[status] ?? {
    text: status,
    className: 'bg-neutral-100 text-neutral-700',
  };
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${config.className}`}>
      {config.text}
    </span>
  );
}

function RowActions({
  row,
  approving,
  onApprove,
  onReject,
}: {
  row: ProfileChangeRequestRead;
  approving: boolean;
  onApprove: (id: number) => void;
  onReject: (row: ProfileChangeRequestRead) => void;
}) {
  if (row.status === 'pending') {
    return (
      <div className="flex gap-1">
        <button
          type="button"
          disabled={approving}
          onClick={() => onApprove(row.id)}
          className="rounded bg-green-600 px-2 py-0.5 text-xs text-white transition hover:bg-green-700 disabled:opacity-60"
        >
          승인
        </button>
        <button
          type="button"
          onClick={() => onReject(row)}
          className="rounded bg-red-600 px-2 py-0.5 text-xs text-white transition hover:bg-red-700"
        >
          반려
        </button>
      </div>
    );
  }
  if (row.status === 'rejected' && row.reject_reason) {
    return (
      <span className="text-xs text-text-muted" title={row.reject_reason}>
        사유: {row.reject_reason.length > 20
          ? `${row.reject_reason.slice(0, 20)}…`
          : row.reject_reason}
      </span>
    );
  }
  return <span className="text-xs text-text-muted">-</span>;
}

function RejectPanel({
  target,
  reason,
  pending,
  onReasonChange,
  onConfirm,
  onCancel,
}: {
  target: ProfileChangeRequestRead;
  reason: string;
  pending: boolean;
  onReasonChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded border border-state-error-ring bg-state-error-subtle p-3">
      <p className="mb-2 text-sm font-medium text-state-error">
        반려 사유를 입력해주세요 (ID: {target.id})
      </p>
      <textarea
        className="w-full rounded border border-neutral-border px-2 py-1 text-sm"
        rows={2}
        value={reason}
        onChange={(e) => onReasonChange(e.target.value)}
        placeholder="반려 사유"
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={!reason.trim() || pending}
          onClick={onConfirm}
          className="rounded bg-red-600 px-3 py-1 text-xs text-white transition hover:bg-red-700 disabled:opacity-60"
        >
          {pending ? '처리 중…' : '반려 확인'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-neutral-border px-3 py-1 text-xs transition hover:bg-neutral-subtle"
        >
          취소
        </button>
      </div>
    </div>
  );
}

function AdminProfileChangesContent() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<ProfileChangeRequestStatus | 'all'>('pending');
  const [rejectTarget, setRejectTarget] = useState<ProfileChangeRequestRead | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const listParams = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      status: statusFilter === 'all' ? undefined : statusFilter,
    }),
    [page, statusFilter]
  );

  const listQuery = useQuery({
    queryKey: ['admin-profile-change-requests', listParams],
    queryFn: () => listProfileChangeRequests(listParams),
    staleTime: 5_000,
  });

  const handleError = (error: unknown, fallback: string) => {
    const message =
      error instanceof ApiError
        ? apiErrorToMessage(error.code, error.message)
        : fallback;
    toast.show(message, { type: 'error' });
  };

  const approveMutation = useMutation({
    mutationFn: (id: number) => approveProfileChangeRequest(id),
    onSuccess: () => {
      toast.show('변경 요청을 승인했습니다.', { type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['admin-profile-change-requests'] });
    },
    onError: (error: unknown) => handleError(error, '승인 처리 중 오류가 발생했습니다.'),
  });

  const rejectMutation = useMutation({
    mutationFn: (params: { id: number; reason: string }) =>
      rejectProfileChangeRequest(params.id, params.reason),
    onSuccess: () => {
      toast.show('변경 요청을 반려했습니다.', { type: 'success' });
      setRejectTarget(null);
      setRejectReason('');
      void queryClient.invalidateQueries({ queryKey: ['admin-profile-change-requests'] });
    },
    onError: (error: unknown) => handleError(error, '반려 처리 중 오류가 발생했습니다.'),
  });

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="space-y-4 p-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-text-primary">정보변경 심사</h1>
        <p className="text-sm text-text-secondary">
          회원 이름/기수 변경 요청을 승인 또는 반려합니다.
        </p>
      </header>

      {/* 필터 */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-text-secondary">상태:</label>
        <select
          className="rounded border border-neutral-border px-2 py-1 text-sm"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as ProfileChangeRequestStatus | 'all');
            setPage(0);
          }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* 반려 패널 */}
      {rejectTarget && (
        <RejectPanel
          target={rejectTarget}
          reason={rejectReason}
          pending={rejectMutation.isPending}
          onReasonChange={setRejectReason}
          onConfirm={() =>
            rejectMutation.mutate({
              id: rejectTarget.id,
              reason: rejectReason.trim(),
            })
          }
          onCancel={() => { setRejectTarget(null); setRejectReason(''); }}
        />
      )}

      {/* 테이블 */}
      {listQuery.isLoading ? (
        <p className="text-sm text-text-muted">로딩 중…</p>
      ) : listQuery.isError ? (
        <p className="text-sm text-state-error">목록을 불러오지 못했습니다.</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-text-muted">표시할 항목이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-border text-text-secondary">
              <tr>
                <th className="px-2 py-1">ID</th>
                <th className="px-2 py-1">회원</th>
                <th className="px-2 py-1">변경 필드</th>
                <th className="px-2 py-1">현재 → 요청</th>
                <th className="px-2 py-1">상태</th>
                <th className="px-2 py-1">요청일</th>
                <th className="px-2 py-1">액션</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-b border-neutral-border">
                  <td className="px-2 py-1">{row.id}</td>
                  <td className="px-2 py-1 whitespace-nowrap">
                    {row.member_name ?? '-'}
                    {row.member_student_id && (
                      <span className="ml-1 text-text-muted">({row.member_student_id})</span>
                    )}
                  </td>
                  <td className="px-2 py-1">{FIELD_LABELS[row.field_name] ?? row.field_name}</td>
                  <td className="px-2 py-1">
                    {row.old_value} → {row.new_value}
                  </td>
                  <td className="px-2 py-1"><StatusBadge status={row.status} /></td>
                  <td className="px-2 py-1 whitespace-nowrap">
                    {new Date(row.requested_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-2 py-1">
                    <RowActions
                      row={row}
                      approving={approveMutation.isPending}
                      onApprove={(id) => approveMutation.mutate(id)}
                      onReject={(r) => { setRejectTarget(r); setRejectReason(''); }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 페이지네이션 */}
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>총 {total}건</span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded border border-neutral-border px-2 py-1 disabled:opacity-40"
          >
            이전
          </button>
          <span className="px-2 py-1">
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-neutral-border px-2 py-1 disabled:opacity-40"
          >
            다음
          </button>
        </div>
      </div>
    </section>
  );
}

export default function AdminProfileChangeRequestsPage() {
  const { status } = useAuth();

  if (status !== 'authorized') {
    return <div className="p-6 text-sm text-text-secondary">관리자 로그인이 필요합니다.</div>;
  }

  return (
    <RequirePermission
      permission="admin_profile"
      fallback={<div className="p-6 text-sm text-text-secondary">해당 화면 접근 권한이 없습니다.</div>}
    >
      <AdminProfileChangesContent />
    </RequirePermission>
  );
}
