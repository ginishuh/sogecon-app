"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { RequirePermission } from '../../../components/require-permission';
import { useToast } from '../../../components/toast';
import { useAuth } from '../../../hooks/useAuth';
import { ApiError } from '../../../lib/api';
import { apiErrorToMessage } from '../../../lib/error-map';
import {
  buildActivationMessage,
  buildActivationUrl,
} from '../../../lib/activation';
import {
  approveAdminSignupRequest,
  listAdminSignupRequestActivationTokenLogs,
  listAdminSignupRequests,
  rejectAdminSignupRequest,
  type SignupActivationIssueResponse,
  type SignupActivationIssueLogRead,
  type SignupRequestRead,
  type SignupRequestStatus,
  reissueAdminSignupRequestActivationToken,
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

type Feedback = {
  tone: 'success' | 'error';
  message: string;
};

function FeedbackBanner({ feedback }: { feedback: Feedback | null }) {
  if (feedback == null) return null;

  const className =
    feedback.tone === 'success'
      ? 'border-state-success-ring bg-state-success-subtle text-state-success'
      : 'border-state-error-ring bg-state-error-subtle text-state-error';

  return (
    <div className={`rounded border px-3 py-2 text-sm ${className}`} role="status">
      {feedback.message}
    </div>
  );
}

function useSignupRequestsModel() {
  const { show } = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SignupRequestStatus | 'all'>('all');
  const [rejectTarget, setRejectTarget] = useState<SignupRequestRead | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [lastApprove, setLastApprove] = useState<SignupActivationIssueResponse | null>(
    null
  );
  const [lastIssueLogs, setLastIssueLogs] = useState<SignupActivationIssueLogRead[]>(
    []
  );
  const [feedback, setFeedback] = useState<Feedback | null>(null);

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
    const message =
      error instanceof ApiError
        ? apiErrorToMessage(error.code, error.message)
        : fallbackMessage;

    setFeedback({ tone: 'error', message });
    show(message, { type: 'error' });
  };

  const refreshActivationLogs = async (signupRequestId: number) => {
    try {
      const logs = await listAdminSignupRequestActivationTokenLogs(signupRequestId, 20);
      setLastIssueLogs(logs.items);
    } catch (error) {
      console.warn('가입신청 활성화 토큰 로그 조회 실패', error);
      setLastIssueLogs([]);
    }
  };

  const applyActivationIssue = (data: SignupActivationIssueResponse) => {
    setLastApprove(data);
    void refreshActivationLogs(data.request.id);
  };

  const approveMutation = useMutation({
    mutationFn: (id: number) => approveAdminSignupRequest(id),
    onSuccess: (data) => {
      const message = '가입신청을 승인했습니다.';
      applyActivationIssue(data);
      setFeedback({ tone: 'success', message });
      show(message, { type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['admin-signup-requests'] });
    },
    onError: (error: unknown) => handleError(error, '승인 처리 중 오류가 발생했습니다.'),
  });

  const reissueMutation = useMutation({
    mutationFn: (id: number) => reissueAdminSignupRequestActivationToken(id),
    onSuccess: (data) => {
      const message = '활성화 토큰을 재발급했습니다.';
      applyActivationIssue(data);
      setFeedback({ tone: 'success', message });
      show(message, { type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['admin-signup-requests'] });
    },
    onError: (error: unknown) =>
      handleError(error, '토큰 재발급 중 오류가 발생했습니다.'),
  });

  const rejectMutation = useMutation({
    mutationFn: (params: { id: number; reason: string }) =>
      rejectAdminSignupRequest(params.id, params.reason),
    onSuccess: () => {
      const message = '가입신청을 반려했습니다.';
      setFeedback({ tone: 'success', message });
      show(message, { type: 'success' });
      setRejectTarget(null);
      setRejectReason('');
      void queryClient.invalidateQueries({ queryKey: ['admin-signup-requests'] });
    },
    onError: (error: unknown) => handleError(error, '반려 처리 중 오류가 발생했습니다.'),
  });

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      const message = `${label}을(를) 복사했습니다.`;
      setFeedback({ tone: 'success', message });
      show(message, { type: 'success' });
    } catch {
      const message = '클립보드 복사에 실패했습니다. 직접 복사해 주세요.';
      setFeedback({ tone: 'error', message });
      show(message, { type: 'error' });
    }
  };

  const copyActivationToken = () => {
    if (lastApprove == null) return;
    void copyToClipboard(lastApprove.activation_token, '활성화 토큰');
  };

  const copyActivationLink = () => {
    if (lastApprove == null) return;
    const url = buildActivationUrl(lastApprove.activation_token);
    void copyToClipboard(url, '활성화 링크');
  };

  const copyActivationMessage = () => {
    if (lastApprove == null) return;
    const { name, student_id } = lastApprove.activation_context;
    const url = buildActivationUrl(lastApprove.activation_token);
    const message = buildActivationMessage(name, student_id, url);
    void copyToClipboard(message, '안내문구');
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
    reissueMutation,
    rejectMutation,
    rejectTarget,
    setRejectTarget,
    rejectReason,
    setRejectReason,
    lastApprove,
    copyActivationToken,
    copyActivationLink,
    copyActivationMessage,
    lastIssueLogs,
    feedback,
    clearFeedback: () => setFeedback(null),
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
          대기 중 신청을 승인/반려하고, 승인 시 활성화 토큰·링크·안내문구를 복사해 수동 전달합니다.
        </p>
      </header>

      <FeedbackBanner feedback={model.feedback} />

      <ApproveTokenCard
        lastApprove={model.lastApprove}
        activationLogs={model.lastIssueLogs}
        onCopyToken={model.copyActivationToken}
        onCopyLink={model.copyActivationLink}
        onCopyMessage={model.copyActivationMessage}
      />

      <FiltersPanel
        searchInput={model.searchInput}
        statusFilter={model.statusFilter}
        onSearchInput={model.setSearchInput}
        onStatusFilter={model.setStatusFilter}
        onSearch={() => {
          model.clearFeedback();
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
          model.clearFeedback();
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

      <SignupRequestsTable
        state={listState}
        items={items}
        isApprovePending={model.approveMutation.isPending}
        isReissuePending={model.reissueMutation.isPending}
        isRejectPending={model.rejectMutation.isPending}
        onApprove={(id) => {
          model.clearFeedback();
          model.approveMutation.mutate(id);
        }}
        onReissue={(id) => {
          model.clearFeedback();
          model.reissueMutation.mutate(id);
        }}
        onStartReject={(row) => {
          model.setRejectTarget(row);
          model.setRejectReason('');
        }}
      />

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
