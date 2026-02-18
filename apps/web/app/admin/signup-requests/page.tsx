"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { RequirePermission } from '../../../components/require-permission';
import { useToast } from '../../../components/toast';
import { useAuth } from '../../../hooks/useAuth';
import { ApiError } from '../../../lib/api';
import { apiErrorToMessage } from '../../../lib/error-map';
import {
  approveAdminSignupRequest,
  listAdminSignupRequests,
  rejectAdminSignupRequest,
  type SignupApproveResponse,
  type SignupRequestRead,
  type SignupRequestStatus,
} from '../../../services/signup-requests';
import {
  ApproveTokenCard,
  FiltersPanel,
  getListState,
  PaginationBar,
  RejectPanel,
  SignupRequestsTable,
} from './view';

const PAGE_SIZE = 20;

function useSignupRequestsModel() {
  const { show } = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SignupRequestStatus | 'all'>('all');
  const [rejectTarget, setRejectTarget] = useState<SignupRequestRead | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [lastApprove, setLastApprove] = useState<SignupApproveResponse | null>(null);

  const listParams = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      q: search.trim() || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
    }),
    [page, search, statusFilter]
  );

  const listQuery = useQuery({
    queryKey: ['admin-signup-requests', listParams],
    queryFn: () => listAdminSignupRequests(listParams),
    staleTime: 5_000,
  });

  const handleError = (error: unknown, fallbackMessage: string) => {
    if (error instanceof ApiError) {
      show(apiErrorToMessage(error.code, error.message), { type: 'error' });
      return;
    }
    show(fallbackMessage, { type: 'error' });
  };

  const approveMutation = useMutation({
    mutationFn: (id: number) => approveAdminSignupRequest(id),
    onSuccess: (data) => {
      setLastApprove(data);
      show('가입신청을 승인했습니다.', { type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['admin-signup-requests'] });
    },
    onError: (error: unknown) => handleError(error, '승인 처리 중 오류가 발생했습니다.'),
  });

  const rejectMutation = useMutation({
    mutationFn: (params: { id: number; reason: string }) =>
      rejectAdminSignupRequest(params.id, params.reason),
    onSuccess: () => {
      show('가입신청을 반려했습니다.', { type: 'success' });
      setRejectTarget(null);
      setRejectReason('');
      void queryClient.invalidateQueries({ queryKey: ['admin-signup-requests'] });
    },
    onError: (error: unknown) => handleError(error, '반려 처리 중 오류가 발생했습니다.'),
  });

  const copyActivationToken = async () => {
    if (lastApprove == null) return;
    try {
      await navigator.clipboard.writeText(lastApprove.activation_token);
      show('활성화 토큰을 복사했습니다.', { type: 'success' });
    } catch {
      show('클립보드 복사에 실패했습니다. 직접 복사해 주세요.', { type: 'error' });
    }
  };

  return {
    page,
    setPage,
    searchInput,
    setSearchInput,
    statusFilter,
    setStatusFilter,
    setSearch,
    listQuery,
    approveMutation,
    rejectMutation,
    rejectTarget,
    setRejectTarget,
    rejectReason,
    setRejectReason,
    lastApprove,
    copyActivationToken,
  };
}

function AdminSignupRequestsContent() {
  const model = useSignupRequestsModel();
  const total = model.listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const items = model.listQuery.data?.items ?? [];
  const listState = getListState({
    isLoading: model.listQuery.isLoading,
    isError: model.listQuery.isError,
    itemsLength: items.length,
  });

  return (
    <section className="space-y-4 p-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-text-primary">가입신청 심사</h1>
        <p className="text-sm text-text-secondary">
          대기 중 신청을 승인/반려하고, 승인 시 활성화 토큰을 복사해 수동 전달합니다.
        </p>
      </header>

      <ApproveTokenCard lastApprove={model.lastApprove} onCopy={model.copyActivationToken} />

      <FiltersPanel
        searchInput={model.searchInput}
        statusFilter={model.statusFilter}
        onSearchInput={model.setSearchInput}
        onStatusFilter={model.setStatusFilter}
        onSearch={() => {
          model.setSearch(model.searchInput);
          model.setPage(0);
        }}
      />

      <RejectPanel
        target={model.rejectTarget}
        reason={model.rejectReason}
        isPending={model.rejectMutation.isPending}
        onReason={model.setRejectReason}
        onConfirm={() => {
          if (!model.rejectTarget) return;
          model.rejectMutation.mutate({
            id: model.rejectTarget.id,
            reason: model.rejectReason.trim(),
          });
        }}
        onCancel={() => {
          model.setRejectTarget(null);
          model.setRejectReason('');
        }}
      />

      <div className="overflow-x-auto rounded border border-neutral-border bg-white">
        <table className="min-w-[980px] text-left text-sm">
          <thead>
            <tr className="border-b bg-surface-raised">
              <th className="px-3 py-2">기본 정보</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2">신청/결정 시각</th>
              <th className="px-3 py-2 text-right">액션</th>
            </tr>
          </thead>
          <SignupRequestsTable
            state={listState}
            items={items}
            isApprovePending={model.approveMutation.isPending}
            isRejectPending={model.rejectMutation.isPending}
            onApprove={(id) => model.approveMutation.mutate(id)}
            onStartReject={(row) => {
              model.setRejectTarget(row);
              model.setRejectReason('');
            }}
          />
        </table>
      </div>

      <PaginationBar
        page={model.page}
        total={total}
        totalPages={totalPages}
        isFetching={model.listQuery.isFetching}
        onPrev={() => model.setPage((prev) => Math.max(0, prev - 1))}
        onNext={() => model.setPage((prev) => prev + 1)}
      />
    </section>
  );
}

export default function AdminSignupRequestsPage() {
  const { status } = useAuth();

  if (status !== 'authorized') {
    return <div className="p-6 text-sm text-text-secondary">관리자 로그인이 필요합니다.</div>;
  }

  return (
    <RequirePermission
      permission="admin_signup"
      fallback={<div className="p-6 text-sm text-text-secondary">해당 화면 접근 권한이 없습니다.</div>}
    >
      <AdminSignupRequestsContent />
    </RequirePermission>
  );
}
