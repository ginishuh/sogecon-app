"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { RequirePermission } from '../../../components/require-permission';
import { useToast } from '../../../components/toast';
import { useAuth } from '../../../hooks/useAuth';
import { ApiError } from '../../../lib/api';
import { apiErrorToMessage } from '../../../lib/error-map';
import { ADMIN_PERMISSION_TOKENS, isSuperAdminSession } from '../../../lib/rbac';
import {
  listAdminUsers,
  patchAdminUserRoles,
  type AdminUserRolesRead,
} from '../../../services/admin-users';

const BASE_ROLE_TOKENS = ['member', 'admin', 'super_admin'] as const;
const KNOWN_ROLE_TOKENS = [...BASE_ROLE_TOKENS, ...ADMIN_PERMISSION_TOKENS];
const KNOWN_ROLE_SET = new Set<string>(KNOWN_ROLE_TOKENS);

type Feedback = {
  tone: 'success' | 'error';
  message: string;
};

function normalizeRoles(roles: string[]): string[] {
  return Array.from(
    new Set(
      roles
        .filter((role) => role.trim().length > 0)
        .map((role) => role.trim().toLowerCase())
    )
  );
}

function isSameRoleSet(left: string[], right: string[]): boolean {
  const a = normalizeRoles(left).sort();
  const b = normalizeRoles(right).sort();
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function roleLabel(role: string): string {
  if (role === 'member') return 'member';
  if (role === 'admin') return 'admin';
  if (role === 'super_admin') return 'super_admin';
  if (role === 'admin_posts') return '게시물 관리';
  if (role === 'admin_events') return '행사 관리';
  if (role === 'admin_hero') return '홈 배너 관리';
  if (role === 'admin_notifications') return '알림 관리';
  if (role === 'admin_signup') return '가입신청 심사';
  if (role === 'admin_roles') return '권한 관리';
  return role;
}

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

function RoleChecklist({
  studentId,
  draftRoles,
  disabled,
  onToggle,
}: {
  studentId: string;
  draftRoles: string[];
  disabled: boolean;
  onToggle: (studentId: string, role: string, checked: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1">
      {KNOWN_ROLE_TOKENS.map((role) => (
        <label key={`${studentId}:${role}`} className="text-xs text-text-primary">
          <input
            type="checkbox"
            className="mr-1 align-middle"
            checked={draftRoles.includes(role)}
            disabled={disabled}
            onChange={(e) => onToggle(studentId, role, e.currentTarget.checked)}
          />
          {roleLabel(role)}
        </label>
      ))}
    </div>
  );
}

function UnknownRoleHint({ unknownRoles }: { unknownRoles: string[] }) {
  if (unknownRoles.length === 0) return null;

  return (
    <p className="mt-2 text-xs text-text-muted">
      기타 토큰(보존): {unknownRoles.join(', ')}
    </p>
  );
}

function SaveRoleButton({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: () => void;
}) {
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

function LoadingState() {
  return <p className="rounded border border-neutral-border bg-white px-3 py-8 text-center text-text-muted">로딩 중...</p>;
}

function ErrorState() {
  return <p className="rounded border border-neutral-border bg-white px-3 py-8 text-center text-state-error">목록을 불러오지 못했습니다.</p>;
}

function EmptyState() {
  return <p className="rounded border border-neutral-border bg-white px-3 py-8 text-center text-text-muted">관리자 계정이 없습니다.</p>;
}

function MobileAdminUsersList({
  rows,
  drafts,
  isSuperAdmin,
  isPending,
  onToggle,
  onSave,
}: {
  rows: AdminUserRolesRead[];
  drafts: Record<string, string[]>;
  isSuperAdmin: boolean;
  isPending: boolean;
  onToggle: (studentId: string, role: string, checked: boolean) => void;
  onSave: (studentId: string, roles: string[]) => void;
}) {
  return (
    <div className="space-y-3 md:hidden">
      {rows.map((row) => {
        const draftRoles = drafts[row.student_id] ?? normalizeRoles(row.roles);
        const dirty = !isSameRoleSet(draftRoles, row.roles);
        const unknownRoles = draftRoles.filter((role) => !KNOWN_ROLE_SET.has(role));

        return (
          <article key={`mobile:${row.student_id}`} className="rounded border border-neutral-border bg-white p-3">
            <p className="font-medium text-text-primary">{row.student_id}</p>
            <p className="text-xs text-text-secondary">{row.name || '-'} · {row.email || '-'}</p>
            <p className="mt-1 text-xs text-text-muted">grade: {row.grade} · member 연동: {row.has_member_record ? '연결됨' : '미연결'}</p>

            <div className="mt-3">
              <RoleChecklist
                studentId={row.student_id}
                draftRoles={draftRoles}
                disabled={!isSuperAdmin || isPending}
                onToggle={onToggle}
              />
              <UnknownRoleHint unknownRoles={unknownRoles} />
            </div>

            <div className="mt-3 flex justify-end">
              <SaveRoleButton
                disabled={!isSuperAdmin || !dirty || isPending}
                onClick={() => onSave(row.student_id, draftRoles)}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}

function DesktopAdminUsersTable({
  rows,
  drafts,
  isSuperAdmin,
  isPending,
  onToggle,
  onSave,
}: {
  rows: AdminUserRolesRead[];
  drafts: Record<string, string[]>;
  isSuperAdmin: boolean;
  isPending: boolean;
  onToggle: (studentId: string, role: string, checked: boolean) => void;
  onSave: (studentId: string, roles: string[]) => void;
}) {
  return (
    <div className="hidden overflow-x-auto rounded border border-neutral-border bg-white md:block">
      <table className="min-w-[1200px] text-left text-sm">
        <thead>
          <tr className="border-b bg-surface-raised">
            <th className="px-3 py-2">관리자</th>
            <th className="px-3 py-2">현재 등급/권한</th>
            <th className="px-3 py-2">수정안</th>
            <th className="px-3 py-2 text-right">저장</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const draftRoles = drafts[row.student_id] ?? normalizeRoles(row.roles);
            const dirty = !isSameRoleSet(draftRoles, row.roles);
            const unknownRoles = draftRoles.filter((role) => !KNOWN_ROLE_SET.has(role));

            return (
              <tr key={row.student_id} className="border-b align-top">
                <td className="px-3 py-2">
                  <p className="font-medium text-text-primary">{row.student_id}</p>
                  <p className="text-xs text-text-secondary">{row.name || '-'} · {row.email || '-'}</p>
                  <p className="mt-1 text-xs text-text-muted">member 연동: {row.has_member_record ? '연결됨' : '미연결'}</p>
                </td>
                <td className="px-3 py-2">
                  <p className="text-xs text-text-secondary">grade: {row.grade}</p>
                  <p className="mt-1 text-xs text-text-secondary">roles: {row.roles.join(', ') || '-'}</p>
                </td>
                <td className="px-3 py-2">
                  <RoleChecklist
                    studentId={row.student_id}
                    draftRoles={draftRoles}
                    disabled={!isSuperAdmin || isPending}
                    onToggle={onToggle}
                  />
                  <UnknownRoleHint unknownRoles={unknownRoles} />
                </td>
                <td className="px-3 py-2 text-right">
                  <SaveRoleButton
                    disabled={!isSuperAdmin || !dirty || isPending}
                    onClick={() => onSave(row.student_id, draftRoles)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ReadOnlyNotice({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  if (isSuperAdmin) return null;
  return <p className="text-sm text-state-warning">현재 계정은 조회 전용입니다. (super_admin만 변경 가능)</p>;
}

function AdminUsersBody({
  rows,
  drafts,
  isSuperAdmin,
  isPending,
  isLoading,
  isError,
  onToggle,
  onSave,
}: {
  rows: AdminUserRolesRead[];
  drafts: Record<string, string[]>;
  isSuperAdmin: boolean;
  isPending: boolean;
  isLoading: boolean;
  isError: boolean;
  onToggle: (studentId: string, role: string, checked: boolean) => void;
  onSave: (studentId: string, roles: string[]) => void;
}) {
  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState />;
  if (rows.length === 0) return <EmptyState />;

  return (
    <>
      <MobileAdminUsersList
        rows={rows}
        drafts={drafts}
        isSuperAdmin={isSuperAdmin}
        isPending={isPending}
        onToggle={onToggle}
        onSave={onSave}
      />
      <DesktopAdminUsersTable
        rows={rows}
        drafts={drafts}
        isSuperAdmin={isSuperAdmin}
        isPending={isPending}
        onToggle={onToggle}
        onSave={onSave}
      />
    </>
  );
}

export default function AdminUsersPage() {
  const { status, data: session } = useAuth();
  const { show } = useToast();
  const queryClient = useQueryClient();
  const isSuperAdmin = isSuperAdminSession(session);
  const [drafts, setDrafts] = useState<Record<string, string[]>>({});
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const listQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => listAdminUsers(),
    staleTime: 5_000,
  });

  useEffect(() => {
    if (!listQuery.data) return;
    setDrafts((previous) => {
      const next = { ...previous };
      for (const row of listQuery.data.items) {
        if (!next[row.student_id]) {
          next[row.student_id] = normalizeRoles(row.roles);
        }
      }
      return next;
    });
  }, [listQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (params: { studentId: string; roles: string[] }) =>
      patchAdminUserRoles(params.studentId, params.roles),
    onSuccess: (response) => {
      const message = `권한을 저장했습니다. (${response.updated.student_id})`;
      setDrafts((prev) => ({
        ...prev,
        [response.updated.student_id]: normalizeRoles(response.updated.roles),
      }));
      setFeedback({ tone: 'success', message });
      show(message, { type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof ApiError
          ? apiErrorToMessage(error.code, error.message)
          : '권한 저장 중 오류가 발생했습니다.';
      setFeedback({ tone: 'error', message });
      show(message, { type: 'error' });
    },
  });

  const rows = useMemo(() => listQuery.data?.items ?? [], [listQuery.data]);

  const toggleRole = (studentId: string, role: string, checked: boolean) => {
    setDrafts((prev) => {
      const current = normalizeRoles(prev[studentId] ?? []);
      const without = current.filter((token) => token !== role);
      const nextRoles = checked ? [...without, role] : without;
      return { ...prev, [studentId]: normalizeRoles(nextRoles) };
    });
  };

  const saveRoles = (studentId: string, roles: string[]) => {
    setFeedback(null);
    updateMutation.mutate({ studentId, roles });
  };

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
          <h1 className="text-xl font-semibold text-text-primary">관리자 권한 관리</h1>
          <p className="text-sm text-text-secondary">
            조회는 <code>admin_roles</code> 권한으로 가능하며, 실제 권한 변경은 <code>super_admin</code>만 가능합니다.
          </p>
          <ReadOnlyNotice isSuperAdmin={isSuperAdmin} />
        </header>

        <FeedbackBanner feedback={feedback} />

        <AdminUsersBody
          rows={rows}
          drafts={drafts}
          isSuperAdmin={isSuperAdmin}
          isPending={updateMutation.isPending}
          isLoading={listQuery.isLoading}
          isError={listQuery.isError}
          onToggle={toggleRole}
          onSave={saveRoles}
        />
      </section>
    </RequirePermission>
  );
}
