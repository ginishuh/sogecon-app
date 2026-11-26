"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { AdminAuthState } from '../../../components/admin-auth-state';
import { RequirePermission } from '../../../components/require-permission';
import { useToast } from '../../../components/toast';
import { useAuth } from '../../../hooks/useAuth';
import { ApiError } from '../../../lib/api';
import { adminApiErrorToMessage } from '../../../lib/error-map';
import {
  buildActivationMessage,
  buildActivationUrl,
} from '../../../lib/activation';
import {
  approveAdminSignupRequest,
  listAdminSignupRequestActivationTokenLogs,
  listAdminSignupRequests,
  rejectAdminSignupRequest,
  sendAdminSignupActivationEmail,
  type SignupActivationIssueResponse,
  type SignupActivationIssueLogRead,
  type SignupRequestRead,
  type SignupRequestStatus,
  reissueAdminSignupRequestActivationToken,
} from '../../../services/signup-requests';
import {
  approveFeedback,
  isCardBlockingSendFailure,
  reissueFeedback,
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
  // null: 현재 카드의 발급 이력을 불러오는 중(직전 카드의 이력을 보이지 않는다).
  const [lastIssueLogs, setLastIssueLogs] = useState<SignupActivationIssueLogRead[] | null>(
    []
  );
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  // 비동기 응답(발송·기록 조회)이 늦게 와도 그사이 바뀐 다른 신청 카드를 덮지 않게 한다.
  const currentCardRef = useRef<{ requestId: number; issueId: number } | null>(null);
  // 같은 신청을 다시 조회해도 가장 최근 조회 결과만 반영한다.
  const logsSeqRef = useRef(0);

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

  const errorMessage = (error: unknown, fallbackMessage: string) =>
    error instanceof ApiError
      ? adminApiErrorToMessage(error.code, error.message)
      : fallbackMessage;

  const handleError = (error: unknown, fallbackMessage: string) => {
    const message = errorMessage(error, fallbackMessage);
    setFeedback({ tone: 'error', message });
    show(message, { type: 'error' });
  };

  const isCurrentCard = (requestId: number, issueId: number) =>
    currentCardRef.current?.requestId === requestId &&
    currentCardRef.current.issueId === issueId;

  const refreshActivationLogs = async (signupRequestId: number) => {
    const seq = ++logsSeqRef.current;
    try {
      const logs = await listAdminSignupRequestActivationTokenLogs(signupRequestId, 20);
      if (seq !== logsSeqRef.current) return;
      setLastIssueLogs(logs.items);
    } catch (error) {
      if (seq !== logsSeqRef.current) return;
      setLastIssueLogs([]);
      handleError(error, '활성화 안내 기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  };

  const applyActivationIssue = (data: SignupActivationIssueResponse) => {
    currentCardRef.current = { requestId: data.request.id, issueId: data.activation_issue.id };
    setLastApprove(data);
    setLastIssueLogs(null);
    void refreshActivationLogs(data.request.id);
  };

  const approveMutation = useMutation({
    mutationFn: (id: number) => approveAdminSignupRequest(id),
    onSuccess: (data) => {
      const next = approveFeedback(data.activation_email);
      applyActivationIssue(data);
      setFeedback(next);
      show(next.message, { type: next.tone });
      void queryClient.invalidateQueries({ queryKey: ['admin-signup-requests'] });
    },
    onError: (error: unknown) => {
      handleError(error, '승인 처리 중 오류가 발생했습니다.');
      void queryClient.invalidateQueries({ queryKey: ['admin-signup-requests'] });
    },
  });

  const reissueMutation = useMutation({
    mutationFn: (id: number) => reissueAdminSignupRequestActivationToken(id),
    onSuccess: (data) => {
      const next = reissueFeedback(data.activation_email);
      applyActivationIssue(data);
      setFeedback(next);
      show(next.message, { type: next.tone });
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

  const sendEmailMutation = useMutation({
    mutationFn: (target: { requestId: number; issueId: number; token: string; label: string }) =>
      sendAdminSignupActivationEmail(target.requestId, target.token),
    onSuccess: (data, target) => {
      // 토스트는 어느 신청의 결과인지 밝히고, 화면 배너·카드는 같은 카드일 때만 바꾼다.
      show(`${target.label} 안내 메일을 ${data.sent_to}으로 보냈습니다.`, { type: 'success' });
      if (!isCurrentCard(target.requestId, target.issueId)) return;
      setFeedback({ tone: 'success', message: `${data.sent_to}으로 안내 메일을 보냈습니다.` });
      setLastApprove((prev) =>
        prev != null &&
        prev.request.id === target.requestId &&
        prev.activation_issue.id === target.issueId
          ? {
              ...prev,
              // 실제로 나간 주소를 "보낼 주소"에도 반영한다(그사이 회원 이메일이 바뀐 경우).
              activation_context: { ...prev.activation_context, email: data.sent_to },
              activation_email: { status: 'sent', sent_to: data.sent_to, error_code: null },
            }
          : prev
      );
      void refreshActivationLogs(target.requestId);
    },
    onError: (error: unknown, target) => {
      const message = errorMessage(
        error,
        '안내 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.'
      );
      show(`${target.label} ${message}`, { type: 'error' });
      if (!isCurrentCard(target.requestId, target.issueId)) return;
      setFeedback({ tone: 'error', message });
      const code = error instanceof ApiError ? error.code : undefined;
      if (code != null && isCardBlockingSendFailure(code)) {
        // 이 카드로는 더 보낼 수 없다. 옛 주소·성공 표시를 치우고 실패 사유를 남긴다.
        setLastApprove((prev) =>
          prev != null &&
          prev.request.id === target.requestId &&
          prev.activation_issue.id === target.issueId
            ? {
                ...prev,
                activation_context: { ...prev.activation_context, email: '' },
                activation_email: { status: 'failed', sent_to: null, error_code: code },
              }
            : prev
        );
      }
    },
  });

  const sendActivationEmail = () => {
    if (lastApprove == null) return;
    const { name, student_id } = lastApprove.activation_context;
    sendEmailMutation.mutate({
      requestId: lastApprove.request.id,
      issueId: lastApprove.activation_issue.id,
      token: lastApprove.activation_token,
      label: `${name}(${student_id})`,
    });
  };

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
    sendEmailMutation,
    sendActivationEmail,
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
          대기 중 신청을 승인/반려합니다. 승인하면 신청 이메일로 안내 메일이 자동으로 나갑니다. 메일을 보내지 못했거나 다시 보내야 하면 아래에서 다시 보내거나 링크와 안내문구를 복사해 전달하세요.
        </p>
      </header>

      <FeedbackBanner feedback={model.feedback} />

      <ApproveTokenCard
        lastApprove={model.lastApprove}
        activationLogs={model.lastIssueLogs}
        onCopyToken={model.copyActivationToken}
        onCopyLink={model.copyActivationLink}
        onCopyMessage={model.copyActivationMessage}
        onSendEmail={() => {
          model.clearFeedback();
          model.sendActivationEmail();
        }}
        isSendPending={model.sendEmailMutation.isPending}
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

  if (status !== 'authorized') return <AdminAuthState status={status} />;

  return (
    <RequirePermission
      permission="admin_signup"
      fallback={<div className="p-6 text-sm text-text-secondary">해당 화면 접근 권한이 없습니다.</div>}
    >
      <AdminSignupRequestsContent />
    </RequirePermission>
  );
}
