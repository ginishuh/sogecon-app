"use client";

import {
  buildActivationMessage,
  buildActivationUrl,
} from '../../../lib/activation';
import { formatPhone } from '../../../lib/phone-utils';
import type {
  SignupActivationIssueResponse,
  SignupActivationIssueLogRead,
  SignupRequestRead,
  SignupRequestStatus,
} from '../../../services/signup-requests';

export type ListState = 'loading' | 'error' | 'empty' | 'ready';

function issueTypeLabel(value: 'approve' | 'reissue'): string {
  return value === 'approve' ? '승인 발급' : '재발급';
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('ko-KR');
}

function statusBadgeClass(status: SignupRequestStatus): string {
  if (status === 'pending') return 'bg-state-info-subtle text-state-info ring-state-info-ring';
  if (status === 'approved') return 'bg-state-success-subtle text-state-success ring-state-success-ring';
  if (status === 'rejected') return 'bg-state-error-subtle text-state-error ring-state-error-ring';
  return 'bg-neutral-subtle text-text-secondary ring-neutral-border';
}

export function getListState(params: {
  isLoading: boolean;
  isError: boolean;
  itemsLength: number;
}): ListState {
  if (params.isLoading) return 'loading';
  if (params.isError) return 'error';
  if (params.itemsLength === 0) return 'empty';
  return 'ready';
}

function ListFallback({ state }: { state: ListState }) {
  if (state === 'loading') {
    return <p className="rounded border border-neutral-border bg-white px-3 py-8 text-center text-text-muted">로딩 중...</p>;
  }
  if (state === 'error') {
    return <p className="rounded border border-neutral-border bg-white px-3 py-8 text-center text-state-error">목록을 불러오지 못했습니다.</p>;
  }
  if (state === 'empty') {
    return <p className="rounded border border-neutral-border bg-white px-3 py-8 text-center text-text-muted">조회 결과가 없습니다.</p>;
  }
  return null;
}

export function ApproveTokenCard({
  lastApprove,
  activationLogs,
  onCopyToken,
  onCopyLink,
  onCopyMessage,
}: {
  lastApprove: SignupActivationIssueResponse | null;
  activationLogs: SignupActivationIssueLogRead[];
  onCopyToken: () => void;
  onCopyLink: () => void;
  onCopyMessage: () => void;
}) {
  if (lastApprove == null) return null;

  const { name, student_id } = lastApprove.activation_context;
  const activationUrl = buildActivationUrl(lastApprove.activation_token);
  const activationMessage = buildActivationMessage(name, student_id, activationUrl);
  const currentIssue = lastApprove.activation_issue;

  const copyBtnClass =
    'rounded border border-state-success-ring px-3 py-1 text-xs text-state-success hover:bg-white';

  return (
    <div className="space-y-3 rounded border border-state-success-ring bg-state-success-subtle p-4">
      <p className="text-sm font-medium text-state-success">
        최근 발급 대상: {name} ({student_id})
      </p>
      <p className="text-xs text-state-success">
        최근 발급: {issueTypeLabel(currentIssue.issued_type)} · 담당 {currentIssue.issued_by_student_id} ·{' '}
        {formatDate(currentIssue.issued_at)}
      </p>

      {/* 토큰 */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-state-success">활성화 토큰</span>
          <button type="button" className={copyBtnClass} onClick={onCopyToken}>
            토큰 복사
          </button>
        </div>
        <p className="break-all rounded bg-white px-3 py-2 text-xs text-text-secondary">
          {lastApprove.activation_token}
        </p>
      </div>

      {/* 활성화 링크 */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-state-success">활성화 링크</span>
          <button type="button" className={copyBtnClass} onClick={onCopyLink}>
            링크 복사
          </button>
        </div>
        <p className="break-all rounded bg-white px-3 py-2 text-xs text-text-secondary">
          {activationUrl}
        </p>
      </div>

      {/* 안내문구 */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-state-success">안내문구</span>
          <button type="button" className={copyBtnClass} onClick={onCopyMessage}>
            안내문구 복사
          </button>
        </div>
        <p className="whitespace-pre-line break-all rounded bg-white px-3 py-2 text-xs text-text-secondary">
          {activationMessage}
        </p>
      </div>

      <div className="space-y-1">
        <span className="text-xs font-medium text-state-success">최근 발급 이력</span>
        {activationLogs.length === 0 ? (
          <p className="rounded bg-white px-3 py-2 text-xs text-text-muted">
            아직 발급 이력이 없습니다.
          </p>
        ) : (
          <ul className="space-y-1">
            {activationLogs.slice(0, 5).map((log) => (
              <li key={log.id} className="rounded bg-white px-3 py-2 text-xs text-text-secondary">
                {formatDate(log.issued_at)} · {issueTypeLabel(log.issued_type)} · 담당{' '}
                {log.issued_by_student_id} · 토큰 식별자 {log.token_tail ?? '-'}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function FiltersPanel({
  searchInput,
  statusFilter,
  onSearchInput,
  onStatusFilter,
  onSearch,
}: {
  searchInput: string;
  statusFilter: SignupRequestStatus | 'all';
  onSearchInput: (value: string) => void;
  onStatusFilter: (value: SignupRequestStatus | 'all') => void;
  onSearch: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded border border-neutral-border bg-white p-3">
      <label className="text-xs text-text-secondary">
        검색
        <input
          className="mt-1 block w-56 rounded border border-neutral-border px-3 py-2 text-sm"
          placeholder="학번/이름/이메일"
          value={searchInput}
          onChange={(e) => onSearchInput(e.currentTarget.value)}
        />
      </label>
      <label className="text-xs text-text-secondary">
        상태
        <select
          className="mt-1 block rounded border border-neutral-border px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => onStatusFilter(e.currentTarget.value as SignupRequestStatus | 'all')}
        >
          <option value="all">전체</option>
          <option value="pending">대기</option>
          <option value="approved">승인</option>
          <option value="rejected">반려</option>
          <option value="activated">활성화 완료</option>
        </select>
      </label>
      <button
        type="button"
        className="rounded bg-brand-700 px-4 py-2 text-sm text-white"
        onClick={onSearch}
      >
        조회
      </button>
    </div>
  );
}

export function RejectPanel({
  target,
  reason,
  isPending,
  onReason,
  onConfirm,
  onCancel,
}: {
  target: SignupRequestRead | null;
  reason: string;
  isPending: boolean;
  onReason: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (target == null) return null;

  return (
    <div className="space-y-2 rounded border border-state-error-ring bg-state-error-subtle p-4">
      <p className="text-sm font-medium text-state-error">
        반려 사유 입력: {target.name} ({target.student_id})
      </p>
      <textarea
        rows={3}
        className="w-full rounded border border-neutral-border px-3 py-2 text-sm"
        value={reason}
        onChange={(e) => onReason(e.currentTarget.value)}
      />
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded bg-state-error px-3 py-1.5 text-sm text-white disabled:opacity-60"
          disabled={isPending || reason.trim().length === 0}
          onClick={onConfirm}
        >
          {isPending ? '처리 중...' : '반려 확정'}
        </button>
        <button
          type="button"
          className="rounded border border-neutral-border px-3 py-1.5 text-sm"
          onClick={onCancel}
        >
          취소
        </button>
      </div>
    </div>
  );
}

function SignupRequestMobileCard({
  row,
  isApprovePending,
  isReissuePending,
  isRejectPending,
  onApprove,
  onReissue,
  onStartReject,
}: {
  row: SignupRequestRead;
  isApprovePending: boolean;
  isReissuePending: boolean;
  isRejectPending: boolean;
  onApprove: (id: number) => void;
  onReissue: (id: number) => void;
  onStartReject: (row: SignupRequestRead) => void;
}) {
  return (
    <article className="rounded border border-neutral-border bg-white p-3">
      <p className="font-medium text-text-primary">{row.name} ({row.student_id})</p>
      <p className="text-xs text-text-secondary">{row.email}</p>
      <p className="mt-1 text-xs text-text-muted">
        기수 {row.cohort}
        {row.major ? ` · ${row.major}` : ''}
        {row.phone ? ` · ${formatPhone(row.phone)}` : ''}
      </p>
      <div className="mt-2 flex items-center justify-between">
        <span className={`inline-flex rounded px-2 py-0.5 text-xs ring-1 ${statusBadgeClass(row.status)}`}>
          {row.status}
        </span>
        <p className="text-xs text-text-muted">신청: {formatDate(row.requested_at)}</p>
      </div>
      {row.reject_reason ? <p className="mt-1 text-xs text-state-error">반려 사유: {row.reject_reason}</p> : null}
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          className="rounded border border-state-success-ring px-3 py-1.5 text-xs text-state-success disabled:opacity-40"
          disabled={row.status !== 'pending' || isApprovePending}
          onClick={() => onApprove(row.id)}
        >
          승인
        </button>
        <button
          type="button"
          className="rounded border border-brand-500 px-3 py-1.5 text-xs text-brand-700 disabled:opacity-40"
          disabled={row.status !== 'approved' || isReissuePending}
          onClick={() => onReissue(row.id)}
        >
          재발급
        </button>
        <button
          type="button"
          className="rounded border border-state-error-ring px-3 py-1.5 text-xs text-state-error disabled:opacity-40"
          disabled={row.status !== 'pending' || isRejectPending}
          onClick={() => onStartReject(row)}
        >
          반려
        </button>
      </div>
    </article>
  );
}

export function SignupRequestsTable({
  state,
  items,
  isApprovePending,
  isReissuePending,
  isRejectPending,
  onApprove,
  onReissue,
  onStartReject,
}: {
  state: ListState;
  items: SignupRequestRead[];
  isApprovePending: boolean;
  isReissuePending: boolean;
  isRejectPending: boolean;
  onApprove: (id: number) => void;
  onReissue: (id: number) => void;
  onStartReject: (row: SignupRequestRead) => void;
}) {
  if (state !== 'ready') return <ListFallback state={state} />;

  return (
    <>
      <div className="space-y-3 md:hidden">
        {items.map((row) => (
          <SignupRequestMobileCard
            key={`mobile:${row.id}`}
            row={row}
            isApprovePending={isApprovePending}
            isReissuePending={isReissuePending}
            isRejectPending={isRejectPending}
            onApprove={onApprove}
            onReissue={onReissue}
            onStartReject={onStartReject}
          />
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded border border-neutral-border bg-white md:block">
        <table className="min-w-[980px] text-left text-sm">
          <thead>
            <tr className="border-b bg-surface-raised">
              <th className="px-3 py-2">기본 정보</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2">신청/결정 시각</th>
              <th className="px-3 py-2 text-right">액션</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="border-b align-top">
                <td className="px-3 py-2">
                  <p className="font-medium text-text-primary">{row.name} ({row.student_id})</p>
                  <p className="text-xs text-text-secondary">{row.email}</p>
                  <p className="mt-1 text-xs text-text-muted">
                    기수 {row.cohort}
                    {row.major ? ` · ${row.major}` : ''}
                    {row.phone ? ` · ${formatPhone(row.phone)}` : ''}
                  </p>
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-flex rounded px-2 py-0.5 text-xs ring-1 ${statusBadgeClass(row.status)}`}>
                    {row.status}
                  </span>
                  {row.reject_reason ? <p className="mt-1 text-xs text-state-error">{row.reject_reason}</p> : null}
                </td>
                <td className="px-3 py-2 text-xs text-text-secondary">
                  <p>신청: {formatDate(row.requested_at)}</p>
                  <p>결정: {formatDate(row.decided_at)}</p>
                  <p>활성화: {formatDate(row.activated_at)}</p>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="rounded border border-state-success-ring px-3 py-1.5 text-xs text-state-success disabled:opacity-40"
                      disabled={row.status !== 'pending' || isApprovePending}
                      onClick={() => onApprove(row.id)}
                    >
                      승인
                    </button>
                    <button
                      type="button"
                      className="rounded border border-brand-500 px-3 py-1.5 text-xs text-brand-700 disabled:opacity-40"
                      disabled={row.status !== 'approved' || isReissuePending}
                      onClick={() => onReissue(row.id)}
                    >
                      재발급
                    </button>
                    <button
                      type="button"
                      className="rounded border border-state-error-ring px-3 py-1.5 text-xs text-state-error disabled:opacity-40"
                      disabled={row.status !== 'pending' || isRejectPending}
                      onClick={() => onStartReject(row)}
                    >
                      반려
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function PaginationBar({
  page,
  total,
  totalPages,
  isFetching,
  onPrev,
  onNext,
}: {
  page: number;
  total: number;
  totalPages: number;
  isFetching: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-text-secondary">
        페이지 {page + 1} / {totalPages} · 총 {total}건
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded border border-neutral-border px-3 py-1 text-sm disabled:opacity-40"
          disabled={page === 0 || isFetching}
          onClick={onPrev}
        >
          이전
        </button>
        <button
          type="button"
          className="rounded border border-neutral-border px-3 py-1 text-sm disabled:opacity-40"
          disabled={page >= totalPages - 1 || isFetching}
          onClick={onNext}
        >
          다음
        </button>
      </div>
    </div>
  );
}
