"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useToast } from '../../components/toast';
import { ApiError } from '../../lib/api';
import { apiErrorToMessage } from '../../lib/error-map';
import {
  createChangeRequest,
  listMyChangeRequests,
  type MemberDto,
  type ProfileChangeRequestRead,
} from '../../services/me';

const STATUS_LABELS: Record<string, { text: string; className: string }> = {
  pending: {
    text: '대기',
    className: 'bg-amber-100 text-amber-800',
  },
  approved: {
    text: '승인',
    className: 'bg-green-100 text-green-800',
  },
  rejected: {
    text: '반려',
    className: 'bg-red-100 text-red-800',
  },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_LABELS[status] ?? {
    text: status,
    className: 'bg-neutral-100 text-neutral-700',
  };
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      {config.text}
    </span>
  );
}

const FIELD_LABELS: Record<string, string> = {
  name: '이름',
  cohort: '기수',
};

type InlineFormProps = {
  fieldName: 'name' | 'cohort';
  currentValue: string;
  hasPending: boolean;
  onClose: () => void;
};

function InlineForm({ fieldName, currentValue, hasPending, onClose }: InlineFormProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [value, setValue] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      createChangeRequest({ field_name: fieldName, new_value: value.trim() }),
    onSuccess: () => {
      toast.show('변경 요청이 접수되었습니다.', { type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['me', 'change-requests'] });
      onClose();
    },
    onError: (error: unknown) => {
      const message =
        error instanceof ApiError
          ? apiErrorToMessage(error.code, error.message)
          : '요청 처리 중 오류가 발생했습니다.';
      toast.show(message, { type: 'error' });
    },
  });

  const label = FIELD_LABELS[fieldName] ?? fieldName;

  if (hasPending) {
    return (
      <p className="text-xs text-amber-700">
        이미 대기 중인 {label} 변경 요청이 있습니다.
      </p>
    );
  }

  return (
    <div className="flex items-end gap-2">
      <label className="flex flex-1 flex-col text-xs">
        <span className="mb-1 text-text-secondary">
          새 {label} (현재: {currentValue})
        </span>
        <input
          className="rounded border border-neutral-border px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-400"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`새 ${label} 입력`}
        />
      </label>
      <button
        type="button"
        disabled={!value.trim() || mutation.isPending}
        onClick={() => mutation.mutate()}
        className="rounded bg-brand-700 px-3 py-1 text-xs text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {mutation.isPending ? '요청 중…' : '요청'}
      </button>
      <button
        type="button"
        onClick={onClose}
        className="rounded border border-neutral-border px-3 py-1 text-xs text-text-secondary transition hover:bg-neutral-subtle"
      >
        취소
      </button>
    </div>
  );
}

type ChangeRequestSectionProps = {
  profile: MemberDto;
};

export function ChangeRequestSection({ profile }: ChangeRequestSectionProps) {
  const [editingField, setEditingField] = useState<'name' | 'cohort' | null>(null);

  const { data: requests } = useQuery({
    queryKey: ['me', 'change-requests'],
    queryFn: listMyChangeRequests,
    staleTime: 10_000,
  });

  const pendingFields = new Set(
    (requests ?? [])
      .filter((r: ProfileChangeRequestRead) => r.status === 'pending')
      .map((r: ProfileChangeRequestRead) => r.field_name)
  );

  const fieldRows: Array<{ key: 'name' | 'cohort'; label: string; value: string }> = [
    { key: 'name', label: '이름', value: profile.name },
    { key: 'cohort', label: '기수', value: String(profile.cohort) },
  ];

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-text-primary">이름 / 기수</h3>
      <p className="text-xs text-text-muted">
        이름과 기수는 관리자 승인을 거쳐 변경됩니다.
      </p>
      <div className="rounded border border-neutral-border bg-surface-raised p-3">
        {fieldRows.map(({ key, label, value }) => (
          <div key={key} className="mb-2 last:mb-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-text-secondary">{label}</span>
                <span className="text-text-primary">{value}</span>
                {pendingFields.has(key) && <StatusBadge status="pending" />}
              </div>
              {editingField !== key && (
                <button
                  type="button"
                  onClick={() => setEditingField(key)}
                  className="text-xs text-brand-600 underline transition hover:text-brand-800"
                >
                  변경 요청
                </button>
              )}
            </div>
            {editingField === key && (
              <div className="mt-2">
                <InlineForm
                  fieldName={key}
                  currentValue={value}
                  hasPending={pendingFields.has(key)}
                  onClose={() => setEditingField(null)}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 요청 이력 */}
      {requests && requests.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-text-secondary hover:text-text-primary">
            변경 요청 이력 ({requests.length}건)
          </summary>
          <ul className="mt-2 space-y-1">
            {requests.map((r: ProfileChangeRequestRead) => (
              <li
                key={r.id}
                className="flex items-center gap-2 rounded border border-neutral-border px-2 py-1"
              >
                <StatusBadge status={r.status} />
                <span className="text-text-secondary">
                  {FIELD_LABELS[r.field_name] ?? r.field_name}
                </span>
                <span className="text-text-muted">
                  {r.old_value} → {r.new_value}
                </span>
                {r.reject_reason && (
                  <span className="text-red-600">(사유: {r.reject_reason})</span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
