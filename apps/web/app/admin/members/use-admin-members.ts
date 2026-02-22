"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { applyRoleHierarchy, normalizeRoles } from './role-shared';
import { memberRoles } from './members-table';
import type { Feedback, RoleFilter } from './member-parts';
import { ROLE_FILTER_MATCHERS } from './member-parts';
import { useToast } from '../../../components/toast';
import { ApiError } from '../../../lib/api';
import { apiErrorToMessage } from '../../../lib/error-map';
import {
  createMemberDirect,
  listMembersForAdmin,
  countMembersForAdmin,
  updateMemberRoles,
  type DirectMemberCreatePayload,
  type DirectMemberCreateResponse,
} from '../../../services/admin-members';
const PAGE_SIZE = 20;

export function useAdminMembersModel() {
  const { show } = useToast();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<number, string[]>>({});
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [createFormResetKey, setCreateFormResetKey] = useState(0);
  const [lastCreate, setLastCreate] = useState<DirectMemberCreateResponse | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortValue, setSortValue] = useState('recent');
  const [page, setPage] = useState(0);

  const offset = page * PAGE_SIZE;

  const listQuery = useQuery({
    queryKey: ['members', 'admin-list', searchQuery, sortValue, offset],
    queryFn: () => listMembersForAdmin({
      q: searchQuery || undefined,
      sort: sortValue,
      limit: PAGE_SIZE,
      offset,
    }),
    staleTime: 5_000,
  });

  const countQuery = useQuery({
    queryKey: ['members', 'admin-count', searchQuery],
    queryFn: () => countMembersForAdmin({
      q: searchQuery || undefined,
    }),
    staleTime: 10_000,
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

  // 검색어/정렬 변경 시 페이지 리셋
  useEffect(() => { setPage(0); }, [searchQuery, sortValue]);

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
      return { ...prev, [memberId]: applyRoleHierarchy(current, role, checked) };
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

  const totalCount = countQuery.data ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasPrev = page > 0;
  const hasNext = page < totalPages - 1;

  return {
    listQuery,
    countQuery,
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
    searchQuery,
    setSearchQuery,
    sortValue,
    setSortValue,
    page,
    setPage,
    totalCount,
    totalPages,
    hasPrev,
    hasNext,
    pageSize: PAGE_SIZE,
  };
}
