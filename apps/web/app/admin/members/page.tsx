"use client";

import { useEffect, useRef, useState } from 'react';
import { AdminAuthState } from '../../../components/admin-auth-state';
import { DirectMemberCreateForm } from './create-form';
import { MembersBody } from './members-table';
import { useAdminMembersModel } from './use-admin-members';
import {
  FeedbackBanner,
  ActivationTokenCard,
  RoleFilterBar,
} from './member-parts';
import { RequirePermission } from '../../../components/require-permission';
import { Button } from '../../../components/ui/button';
import { FIELD_CONTROL } from '../../../components/ui/styles';
import { useAuth } from '../../../hooks/useAuth';
import { hasPermissionSession, isSuperAdminSession } from '../../../lib/rbac';

const SORT_OPTIONS = [
  { value: 'recent', label: '최근 수정순' },
  { value: 'cohort_desc', label: '기수 내림차순' },
  { value: 'cohort_asc', label: '기수 오름차순' },
  { value: 'name', label: '이름순' },
];

function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [local, setLocal] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => { setLocal(value); }, [value]);

  const handleChange = (v: string) => {
    setLocal(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(v), 300);
  };

  return (
    <input
      type="search"
      aria-label="회원 검색"
      className={`${FIELD_CONTROL} text-sm`}
      placeholder="학번, 이름, 이메일 검색..."
      value={local}
      onChange={(e) => handleChange(e.currentTarget.value)}
    />
  );
}

function Pagination({
  page,
  totalPages,
  totalCount,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-text-muted">
        총 {totalCount}명 · {page + 1} / {totalPages} 페이지
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!hasPrev}
          onClick={onPrev}
        >
          이전
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!hasNext}
          onClick={onNext}
        >
          다음
        </Button>
      </div>
    </div>
  );
}

export default function AdminMembersPage() {
  const { status, data: session } = useAuth();
  const isSuperAdmin = isSuperAdminSession(session);
  const canManageMembers =
    status === 'authorized' && hasPermissionSession(session, 'admin_roles');
  const model = useAdminMembersModel({ enabled: canManageMembers });

  if (status !== 'authorized') return <AdminAuthState status={status} />;

  return (
    <RequirePermission
      permission="admin_roles"
      fallback={<div className="p-6 text-sm text-text-secondary">해당 화면 접근 권한이 없습니다.</div>}
    >
      <section className="space-y-4 p-6">
        <header className="space-y-2">
          <h1 className="text-xl font-semibold text-text-primary">회원 관리</h1>
          <p className="text-sm text-text-secondary">
            회원 정보를 조회하고 역할별 운영 범위를 확인합니다. 회원 정보와 역할 변경은
            최고관리자만 할 수 있습니다.
          </p>
          {!isSuperAdmin && (
            <p className="text-sm text-state-warning">
              현재 계정은 조회 전용입니다. 회원 정보와 역할을 변경할 수 없습니다.
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

        {/* 검색/정렬 */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex-1">
            <SearchInput value={model.searchQuery} onChange={model.setSearchQuery} />
          </div>
          <select
            aria-label="정렬 기준"
            className={`${FIELD_CONTROL} text-sm sm:w-auto`}
            value={model.sortValue}
            onChange={(e) => model.setSortValue(e.currentTarget.value)}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

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

        <Pagination
          page={model.page}
          totalPages={model.totalPages}
          totalCount={model.totalCount}
          hasPrev={model.hasPrev}
          hasNext={model.hasNext}
          onPrev={() => model.setPage((p) => Math.max(0, p - 1))}
          onNext={() => model.setPage((p) => p + 1)}
        />
      </section>
    </RequirePermission>
  );
}
