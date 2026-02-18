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
} from '../../../services/admin-users';

const BASE_ROLE_TOKENS = ['member', 'admin', 'super_admin'] as const;
const KNOWN_ROLE_TOKENS = [...BASE_ROLE_TOKENS, ...ADMIN_PERMISSION_TOKENS];
const KNOWN_ROLE_SET = new Set<string>(KNOWN_ROLE_TOKENS);

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

export default function AdminUsersPage() {
  const { status, data: session } = useAuth();
  const { show } = useToast();
  const queryClient = useQueryClient();
  const isSuperAdmin = isSuperAdminSession(session);
  const [drafts, setDrafts] = useState<Record<string, string[]>>({});

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
      setDrafts((prev) => ({
        ...prev,
        [response.updated.student_id]: normalizeRoles(response.updated.roles),
      }));
      show(`권한을 저장했습니다. (${response.updated.student_id})`, { type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError) {
        show(apiErrorToMessage(error.code, error.message), { type: 'error' });
        return;
      }
      show('권한 저장 중 오류가 발생했습니다.', { type: 'error' });
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
            조회는 `admin_roles` 권한으로 가능하며, 실제 권한 변경은 `super_admin`만 가능합니다.
          </p>
          {!isSuperAdmin ? (
            <p className="text-sm text-state-warning">
              현재 계정은 조회 전용입니다. (super_admin만 변경 가능)
            </p>
          ) : null}
        </header>

        <div className="overflow-x-auto rounded border border-neutral-border bg-white">
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
              {listQuery.isLoading ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-text-muted">
                    로딩 중...
                  </td>
                </tr>
              ) : listQuery.isError ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-state-error">
                    목록을 불러오지 못했습니다.
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-text-muted">
                    관리자 계정이 없습니다.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const draftRoles = drafts[row.student_id] ?? normalizeRoles(row.roles);
                  const dirty = !isSameRoleSet(draftRoles, row.roles);
                  const unknownRoles = draftRoles.filter(
                    (role) => !KNOWN_ROLE_SET.has(role)
                  );

                  return (
                    <tr key={row.student_id} className="border-b align-top">
                      <td className="px-3 py-2">
                        <p className="font-medium text-text-primary">{row.student_id}</p>
                        <p className="text-xs text-text-secondary">
                          {row.name || '-'} · {row.email || '-'}
                        </p>
                        <p className="mt-1 text-xs text-text-muted">
                          member 연동: {row.has_member_record ? '연결됨' : '미연결'}
                        </p>
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-xs text-text-secondary">grade: {row.grade}</p>
                        <p className="mt-1 text-xs text-text-secondary">
                          roles: {row.roles.join(', ') || '-'}
                        </p>
                      </td>
                      <td className="px-3 py-2">
                        <div className="grid grid-cols-2 gap-1">
                          {KNOWN_ROLE_TOKENS.map((role) => (
                            <label key={`${row.student_id}:${role}`} className="text-xs text-text-primary">
                              <input
                                type="checkbox"
                                className="mr-1 align-middle"
                                checked={draftRoles.includes(role)}
                                disabled={!isSuperAdmin || updateMutation.isPending}
                                onChange={(e) =>
                                  toggleRole(row.student_id, role, e.currentTarget.checked)
                                }
                              />
                              {roleLabel(role)}
                            </label>
                          ))}
                        </div>
                        {unknownRoles.length > 0 ? (
                          <p className="mt-2 text-xs text-text-muted">
                            기타 토큰(보존): {unknownRoles.join(', ')}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          className="rounded bg-brand-700 px-3 py-1.5 text-xs text-white disabled:opacity-40"
                          disabled={!isSuperAdmin || !dirty || updateMutation.isPending}
                          onClick={() =>
                            updateMutation.mutate({
                              studentId: row.student_id,
                              roles: draftRoles,
                            })
                          }
                        >
                          저장
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </RequirePermission>
  );
}
