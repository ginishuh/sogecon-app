"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DirectMemberCreateForm } from './create-form';
import { KNOWN_ROLE_SET, RoleChecklist, normalizeRoles } from './role-shared';
import { RequirePermission } from '../../../components/require-permission';
import { useToast } from '../../../components/toast';
import { useAuth } from '../../../hooks/useAuth';
import { ApiError } from '../../../lib/api';
import {
  buildActivationMessage,
  buildActivationUrl,
} from '../../../lib/activation';
import { apiErrorToMessage } from '../../../lib/error-map';
import { isSuperAdminSession } from '../../../lib/rbac';
import {
  createMemberDirect,
  updateMemberRoles,
  type DirectMemberCreatePayload,
  type DirectMemberCreateResponse,
} from '../../../services/admin-members';
import { listMembers, type Member } from '../../../services/members';

/* ---------- 유틸 ---------- */

type Feedback = { tone: 'success' | 'error'; message: string };
type RoleFilter = 'all' | 'admin' | 'super_admin';

function isSameRoleSet(left: string[], right: string[]): boolean {
  const a = normalizeRoles(left).sort();
  const b = normalizeRoles(right).sort();
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function memberRoles(m: Member): string[] {
  const raw = (m as Record<string, unknown>)['roles'];
  if (typeof raw === 'string') return normalizeRoles(raw.split(','));
  if (Array.isArray(raw)) return normalizeRoles(raw as string[]);
  return ['member'];
}

const ROLE_FILTER_MATCHERS: Record<RoleFilter, (roles: string[]) => boolean> = {
  all: () => true,
  admin: (r) => r.includes('admin') || r.includes('super_admin'),
  super_admin: (r) => r.includes('super_admin'),
};

/* ---------- 소형 컴포넌트 ---------- */

function FeedbackBanner({ feedback }: { feedback: Feedback | null }) {
  if (feedback == null) return null;
  const cls =
    feedback.tone === 'success'
      ? 'border-state-success-ring bg-state-success-subtle text-state-success'
      : 'border-state-error-ring bg-state-error-subtle text-state-error';
  return (
    <div className={`rounded border px-3 py-2 text-sm ${cls}`} role="status">
      {feedback.message}
    </div>
  );
}

function UnknownRoleHint({ unknownRoles }: { unknownRoles: string[] }) {
  if (unknownRoles.length === 0) return null;
  return <p className="mt-2 text-xs text-text-muted">기타 토큰(보존): {unknownRoles.join(', ')}</p>;
}

function SaveRoleButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="rounded bg-brand-700 px-3 py-1.5 text-xs text-white disabled:opacity-40"
      disabled={disabled}
      onClick={onClick}
    >
      저장
    </button>
  );
}

const ROLE_FILTER_OPTIONS: { value: RoleFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'admin', label: 'admin 이상' },
  { value: 'super_admin', label: 'super_admin' },
];

function RoleFilterBar({
  current,
  onChange,
}: {
  current: RoleFilter;
  onChange: (filter: RoleFilter) => void;
}) {
  return (
    <div className="flex gap-2">
      {ROLE_FILTER_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`rounded border px-3 py-1 text-xs ${
            current === opt.value
              ? 'border-brand-700 bg-brand-700 text-white'
              : 'border-neutral-border text-text-secondary hover:bg-surface-raised'
          }`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- 활성화 토큰 카드 ---------- */

function ActivationTokenCard({
  lastCreate,
}: {
  lastCreate: DirectMemberCreateResponse | null;
}) {
  const { show } = useToast();
  if (lastCreate == null) return null;

  const { member, activation_token } = lastCreate;
  const activationUrl = buildActivationUrl(activation_token);
  const activationMessage = buildActivationMessage(
    member.name,
    member.student_id,
    activationUrl,
  );

  const copyBtnClass =
    'rounded border border-state-success-ring px-3 py-1 text-xs text-state-success hover:bg-white';

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    show(`${label} 복사됨`, { type: 'success' });
  };

  return (
    <div className="space-y-3 rounded border border-state-success-ring bg-state-success-subtle p-4">
      <p className="text-sm font-medium text-state-success">
        회원 생성 완료: {member.name} ({member.student_id})
      </p>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-state-success">활성화 토큰</span>
          <button type="button" className={copyBtnClass} onClick={() => copy(activation_token, '토큰')}>
            토큰 복사
          </button>
        </div>
        <p className="break-all rounded bg-white px-3 py-2 text-xs text-text-secondary">
          {activation_token}
        </p>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-state-success">활성화 링크</span>
          <button type="button" className={copyBtnClass} onClick={() => copy(activationUrl, '링크')}>
            링크 복사
          </button>
        </div>
        <p className="break-all rounded bg-white px-3 py-2 text-xs text-text-secondary">
          {activationUrl}
        </p>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-state-success">안내문구</span>
          <button type="button" className={copyBtnClass} onClick={() => copy(activationMessage, '안내문구')}>
            문구 복사
          </button>
        </div>
        <p className="whitespace-pre-wrap break-all rounded bg-white px-3 py-2 text-xs text-text-secondary">
          {activationMessage}
        </p>
      </div>
    </div>
  );
}

/* ---------- 회원 목록 ---------- */

function MemberRow({
  row,
  draftRoles,
  dirty,
  unknownRoles,
  isSuperAdmin,
  isPending,
  onToggle,
  onSave,
}: {
  row: Member;
  draftRoles: string[];
  dirty: boolean;
  unknownRoles: string[];
  isSuperAdmin: boolean;
  isPending: boolean;
  onToggle: (memberId: number, role: string, checked: boolean) => void;
  onSave: (memberId: number, roles: string[]) => void;
}) {
  return (
    <>
      {/* 모바일 카드 */}
      <article className="rounded border border-neutral-border bg-white p-3 md:hidden">
        <p className="font-medium text-text-primary">{row.student_id}</p>
        <p className="text-xs text-text-secondary">{row.name} · {row.email || '-'}</p>
        <p className="mt-1 text-xs text-text-muted">{row.cohort}기 · {row.status}</p>
        <div className="mt-3">
          <RoleChecklist
            id={String(row.id)}
            draftRoles={draftRoles}
            disabled={!isSuperAdmin || isPending}
            onToggle={(id, role, checked) => onToggle(Number(id), role, checked)}
          />
          <UnknownRoleHint unknownRoles={unknownRoles} />
        </div>
        <div className="mt-3 flex justify-end">
          <SaveRoleButton
            disabled={!isSuperAdmin || !dirty || isPending}
            onClick={() => onSave(row.id, draftRoles)}
          />
        </div>
      </article>
    </>
  );
}

function MembersBody({
  rows,
  drafts,
  isSuperAdmin,
  isPending,
  isLoading,
  isError,
  onToggle,
  onSave,
}: {
  rows: Member[];
  drafts: Record<number, string[]>;
  isSuperAdmin: boolean;
  isPending: boolean;
  isLoading: boolean;
  isError: boolean;
  onToggle: (memberId: number, role: string, checked: boolean) => void;
  onSave: (memberId: number, roles: string[]) => void;
}) {
  if (isLoading) {
    return <p className="rounded border border-neutral-border bg-white px-3 py-8 text-center text-text-muted">로딩 중...</p>;
  }
  if (isError) {
    return <p className="rounded border border-neutral-border bg-white px-3 py-8 text-center text-state-error">목록을 불러오지 못했습니다.</p>;
  }
  if (rows.length === 0) {
    return <p className="rounded border border-neutral-border bg-white px-3 py-8 text-center text-text-muted">조건에 맞는 회원이 없습니다.</p>;
  }

  return (
    <>
      {/* 모바일 */}
      <div className="space-y-3 md:hidden">
        {rows.map((row) => {
          const roles = memberRoles(row);
          const dr = drafts[row.id] ?? roles;
          return (
            <MemberRow
              key={`m:${row.id}`}
              row={row}
              draftRoles={dr}
              dirty={!isSameRoleSet(dr, roles)}
              unknownRoles={dr.filter((r) => !KNOWN_ROLE_SET.has(r))}
              isSuperAdmin={isSuperAdmin}
              isPending={isPending}
              onToggle={onToggle}
              onSave={onSave}
            />
          );
        })}
      </div>
      {/* 데스크톱 */}
      <div className="hidden overflow-x-auto rounded border border-neutral-border bg-white md:block">
        <table className="min-w-[1000px] text-left text-sm">
          <thead>
            <tr className="border-b bg-surface-raised">
              <th className="px-3 py-2">회원</th>
              <th className="px-3 py-2">현재 역할</th>
              <th className="px-3 py-2">수정안</th>
              <th className="px-3 py-2 text-right">저장</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const roles = memberRoles(row);
              const dr = drafts[row.id] ?? roles;
              const dirty = !isSameRoleSet(dr, roles);
              const unknown = dr.filter((r) => !KNOWN_ROLE_SET.has(r));
              return (
                <tr key={row.id} className="border-b align-top">
                  <td className="px-3 py-2">
                    <p className="font-medium text-text-primary">{row.student_id}</p>
                    <p className="text-xs text-text-secondary">{row.name} · {row.email || '-'}</p>
                    <p className="mt-1 text-xs text-text-muted">{row.cohort}기 · {row.status}</p>
                  </td>
                  <td className="px-3 py-2">
                    <p className="text-xs text-text-secondary">{roles.join(', ') || '-'}</p>
                  </td>
                  <td className="px-3 py-2">
                    <RoleChecklist
                      id={String(row.id)}
                      draftRoles={dr}
                      disabled={!isSuperAdmin || isPending}
                      onToggle={(id, role, checked) => onToggle(Number(id), role, checked)}
                    />
                    <UnknownRoleHint unknownRoles={unknown} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <SaveRoleButton
                      disabled={!isSuperAdmin || !dirty || isPending}
                      onClick={() => onSave(row.id, dr)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------- 커스텀 훅: 상태/쿼리 관리 ---------- */

function useAdminMembersModel() {
  const { show } = useToast();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<number, string[]>>({});
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [createFormResetKey, setCreateFormResetKey] = useState(0);
  const [lastCreate, setLastCreate] = useState<DirectMemberCreateResponse | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  const listQuery = useQuery({
    queryKey: ['members', 'admin-all'],
    queryFn: () => listMembers({ limit: 500 }),
    staleTime: 5_000,
  });

  useEffect(() => {
    if (!listQuery.data) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const row of listQuery.data) {
        if (!next[row.id]) {
          next[row.id] = memberRoles(row);
        }
      }
      return next;
    });
  }, [listQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (params: { memberId: number; roles: string[] }) =>
      updateMemberRoles(params.memberId, params.roles),
    onSuccess: (response) => {
      const msg = `권한을 저장했습니다. (${response.student_id})`;
      setFeedback({ tone: 'success', message: msg });
      show(msg, { type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['members'] });
    },
    onError: (error: unknown) => {
      const msg = error instanceof ApiError
        ? apiErrorToMessage(error.code, error.message)
        : '권한 저장 중 오류가 발생했습니다.';
      setFeedback({ tone: 'error', message: msg });
      show(msg, { type: 'error' });
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: DirectMemberCreatePayload) => createMemberDirect(payload),
    onSuccess: (response) => {
      const msg = `회원을 생성했습니다. (${response.member.student_id})`;
      setFeedback({ tone: 'success', message: msg });
      show(msg, { type: 'success' });
      setLastCreate(response);
      setCreateFormResetKey((prev) => prev + 1);
      void queryClient.invalidateQueries({ queryKey: ['members'] });
    },
    onError: (error: unknown) => {
      const msg = error instanceof ApiError
        ? apiErrorToMessage(error.code, error.message)
        : '회원 생성 중 오류가 발생했습니다.';
      setFeedback({ tone: 'error', message: msg });
      show(msg, { type: 'error' });
    },
  });

  const filteredRows = useMemo(() => {
    const all = listQuery.data ?? [];
    const matcher = ROLE_FILTER_MATCHERS[roleFilter];
    return all.filter((m) => matcher(memberRoles(m)));
  }, [listQuery.data, roleFilter]);

  const toggleRole = useCallback((memberId: number, role: string, checked: boolean) => {
    setDrafts((prev) => {
      const current = normalizeRoles(prev[memberId] ?? []);
      const without = current.filter((t) => t !== role);
      const nextRoles = checked ? [...without, role] : without;
      return { ...prev, [memberId]: normalizeRoles(nextRoles) };
    });
  }, []);

  const saveRoles = useCallback((memberId: number, roles: string[]) => {
    setFeedback(null);
    updateMutation.mutate({ memberId, roles });
  }, [updateMutation]);

  const handleCreate = useCallback((payload: DirectMemberCreatePayload) => {
    setFeedback(null);
    setLastCreate(null);
    createMutation.mutate(payload);
  }, [createMutation]);

  return {
    listQuery,
    drafts,
    feedback,
    createFormResetKey,
    lastCreate,
    roleFilter,
    setRoleFilter,
    filteredRows,
    toggleRole,
    saveRoles,
    handleCreate,
    updateMutation,
    createMutation,
  };
}

/* ---------- 메인 페이지 ---------- */

export default function AdminMembersPage() {
  const { status, data: session } = useAuth();
  const isSuperAdmin = isSuperAdminSession(session);
  const model = useAdminMembersModel();

  if (status !== 'authorized') {
    return <div className="p-6 text-sm text-text-secondary">관리자 로그인이 필요합니다.</div>;
  }

  return (
    <RequirePermission
      permission="admin_roles"
      fallback={<div className="p-6 text-sm text-text-secondary">해당 화면 접근 권한이 없습니다.</div>}
    >
      <section className="space-y-4 p-6">
        <header className="space-y-2">
          <h1 className="text-xl font-semibold text-text-primary">회원 관리</h1>
          <p className="text-sm text-text-secondary">
            조회는 <code>admin_roles</code> 권한으로 가능하며, 역할 변경 및 직접 생성은{' '}
            <code>super_admin</code>만 가능합니다.
          </p>
          {!isSuperAdmin && (
            <p className="text-sm text-state-warning">
              현재 계정은 조회 전용입니다. (super_admin만 변경 가능)
            </p>
          )}
        </header>

        <FeedbackBanner feedback={model.feedback} />
        <ActivationTokenCard lastCreate={model.lastCreate} />

        {isSuperAdmin ? (
          <DirectMemberCreateForm
            isPending={model.createMutation.isPending}
            resetKey={model.createFormResetKey}
            onSubmit={model.handleCreate}
          />
        ) : null}

        <RoleFilterBar current={model.roleFilter} onChange={model.setRoleFilter} />

        <MembersBody
          rows={model.filteredRows}
          drafts={model.drafts}
          isSuperAdmin={isSuperAdmin}
          isPending={model.updateMutation.isPending}
          isLoading={model.listQuery.isLoading}
          isError={model.listQuery.isError}
          onToggle={model.toggleRole}
          onSave={model.saveRoles}
        />
      </section>
    </RequirePermission>
  );
}
