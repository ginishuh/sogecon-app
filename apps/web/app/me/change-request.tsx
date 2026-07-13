"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CaretDown, IdentificationCard } from '@phosphor-icons/react';
import { useState } from 'react';
import { useToast } from '../../components/toast';
import { ApiError } from '../../lib/api';
import { memberApiErrorToMessage } from '../../lib/error-map';
import Button from '../../components/ui/button';
import { FIELD_CONTROL } from '../../components/ui/styles';
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
          ? memberApiErrorToMessage(error.code, error.message)
          : '변경 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
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
    <div className="mt-3 flex flex-col items-stretch gap-2 rounded-xl bg-white p-3 sm:flex-row sm:items-end">
      <label className="flex flex-1 flex-col text-xs">
        <span className="mb-1 text-text-secondary">
          새 {label} (현재: {currentValue})
        </span>
        <input
          className={FIELD_CONTROL}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`새 ${label} 입력`}
        />
      </label>
      <Button
        type="button"
        disabled={!value.trim() || mutation.isPending}
        onClick={() => mutation.mutate()}
        size="sm"
      >
        {mutation.isPending ? '요청 중…' : '요청'}
      </Button>
      <Button
        type="button"
        onClick={onClose}
        variant="secondary"
        size="sm"
      >
        취소
      </Button>
    </div>
  );
}

type ChangeRequestSectionProps = {
  profile: MemberDto;
};

export function ChangeRequestSection({ profile }: ChangeRequestSectionProps) {
  const [editingField, setEditingField] = useState<'name' | 'cohort' | null>(null);

  const { data: requests, isLoading } = useQuery({
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
    <section aria-labelledby="change-request-title" className="rounded-2xl border border-neutral-border bg-surface-raised p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-brand-700">
          <IdentificationCard size={24} aria-hidden="true" />
        </span>
        <div>
          <h2 id="change-request-title" className="text-xl font-semibold text-text-primary">이름·기수 변경 요청</h2>
          <p className="mt-1 text-sm leading-6 text-text-muted">
            이름과 기수는 동문회 사무국 확인 후 반영돼요.
          </p>
        </div>
      </div>

      <div className="mt-5 divide-y divide-neutral-border rounded-xl border border-neutral-border bg-white px-4">
        {fieldRows.map(({ key, label, value }) => (
          <div key={key} className="py-3">
            <div className="flex min-h-11 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2 text-sm">
                <span className="font-medium text-text-secondary">{label}</span>
                <span className="truncate text-text-primary">{value}</span>
                {pendingFields.has(key) && <StatusBadge status="pending" />}
              </div>
              {editingField !== key && (
                <Button
                  type="button"
                  onClick={() => setEditingField(key)}
                  variant="ghost"
                  size="sm"
                  aria-label={`${label} 변경 요청`}
                  className="shrink-0"
                >
                  변경 요청
                </Button>
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

      {isLoading ? (
        <p className="mt-4 text-sm text-text-muted" role="status">변경 요청 이력을 불러오는 중…</p>
      ) : requests && requests.length > 0 ? (
        <details className="mt-4 text-xs">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 font-medium text-text-secondary hover:text-text-primary">
            변경 요청 이력 {requests.length}건
            <CaretDown size={16} aria-hidden="true" />
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
      ) : (
        <p className="mt-4 text-sm text-text-muted">아직 접수한 변경 요청이 없어요.</p>
      )}
    </section>
  );
}
