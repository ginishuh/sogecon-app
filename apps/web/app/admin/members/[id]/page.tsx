"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { RoleChecklist, applyRoleHierarchy, normalizeRoles } from '../role-shared';
import { RequirePermission } from '../../../../components/require-permission';
import { useToast } from '../../../../components/toast';
import { useAuth } from '../../../../hooks/useAuth';
import { ApiError } from '../../../../lib/api';
import { apiErrorToMessage } from '../../../../lib/error-map';
import { isSuperAdminSession } from '../../../../lib/rbac';
import {
  updateMemberForAdmin,
  updateMemberRoles,
  type AdminMemberUpdate,
} from '../../../../services/admin-members';
import { getMember, type Member } from '../../../../services/members';

type InfoField = {
  key: keyof AdminMemberUpdate;
  label: string;
  type?: 'text' | 'email' | 'number' | 'select';
  options?: { value: string; label: string }[];
};

const INFO_FIELDS: InfoField[] = [
  { key: 'name', label: '이름' },
  { key: 'email', label: '이메일', type: 'email' },
  { key: 'cohort', label: '기수', type: 'number' },
  {
    key: 'status',
    label: '상태',
    type: 'select',
    options: [
      { value: 'active', label: '활성' },
      { value: 'pending', label: '대기' },
      { value: 'suspended', label: '정지' },
      { value: 'rejected', label: '거부' },
    ],
  },
  { key: 'phone', label: '전화번호' },
  { key: 'major', label: '전공' },
  { key: 'company', label: '회사' },
  { key: 'department', label: '부서' },
  { key: 'job_title', label: '직함' },
  { key: 'company_phone', label: '회사 전화' },
  { key: 'industry', label: '업종' },
  { key: 'addr_personal', label: '개인 주소' },
  { key: 'addr_company', label: '회사 주소' },
];

function parseMemberRoles(m: Member): string[] {
  const raw = (m as Record<string, unknown>)['roles'];
  if (typeof raw === 'string') return normalizeRoles(raw.split(','));
  if (Array.isArray(raw)) return normalizeRoles(raw as string[]);
  return ['member'];
}

function getMemberFieldValue(member: Member, key: string): string {
  const val = (member as Record<string, unknown>)[key];
  return val != null ? String(val) : '';
}

// NOT NULL 필드: 빈 값 전송 금지
const REQUIRED_FIELDS = new Set<string>(['name', 'cohort']);

function hasRequiredFieldEmpty(form: Record<string, string>): boolean {
  return Array.from(REQUIRED_FIELDS).some((key) => !(form[key] ?? '').trim());
}

function buildProfileDiff(
  form: Record<string, string>,
  member: Member,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const f of INFO_FIELDS) {
    const val = form[f.key] ?? '';
    const originalStr = getMemberFieldValue(member, f.key);
    if (val === originalStr) continue;
    // 필수 필드는 빈 값이면 diff에서 제외 (null 전송 방지)
    if (REQUIRED_FIELDS.has(f.key) && !val.trim()) continue;
    data[f.key] = f.type === 'number' && val ? Number(val) : (val || null);
  }
  return data;
}

/* ---------- 폼 필드 렌더링 ---------- */

function FieldInput({
  field,
  value,
  editing,
  displayValue,
  onChange,
}: {
  field: InfoField;
  value: string;
  editing: boolean;
  displayValue: string;
  onChange: (key: string, val: string) => void;
}) {
  if (!editing) {
    return <p className="mt-1 text-sm text-text-primary">{displayValue || '-'}</p>;
  }
  if (field.type === 'select' && field.options) {
    return (
      <select
        className="mt-1 w-full rounded border border-neutral-border px-2 py-1 text-sm text-text-primary"
        value={value}
        onChange={(e) => onChange(field.key, e.currentTarget.value)}
      >
        {field.options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    );
  }
  return (
    <input
      type={field.type ?? 'text'}
      className="mt-1 w-full rounded border border-neutral-border px-2 py-1 text-sm text-text-primary"
      value={value}
      onChange={(e) => onChange(field.key, e.currentTarget.value)}
    />
  );
}

/* ---------- 프로필 정보 섹션 ---------- */

function ProfileSection({
  member,
  isSuperAdmin,
  memberId,
}: {
  member: Member;
  isSuperAdmin: boolean;
  memberId: number;
}) {
  const { show } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const f of INFO_FIELDS) {
      initial[f.key] = getMemberFieldValue(member, f.key);
    }
    setForm(initial);
  }, [member]);

  const updateMutation = useMutation({
    mutationFn: (data: AdminMemberUpdate) =>
      updateMemberForAdmin(memberId, data),
    onSuccess: () => {
      show('회원 정보를 수정했습니다.', { type: 'success' });
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: ['members', memberId] });
    },
    onError: (error: unknown) => {
      const msg = error instanceof ApiError
        ? apiErrorToMessage(error.code, error.message)
        : '수정 중 오류가 발생했습니다.';
      show(msg, { type: 'error' });
    },
  });

  const requiredEmpty = hasRequiredFieldEmpty(form);

  const handleSave = () => {
    if (requiredEmpty) {
      show('이름과 기수는 필수 입력값입니다.', { type: 'error' });
      return;
    }
    const data = buildProfileDiff(form, member);
    if (Object.keys(data).length === 0) {
      show('변경된 항목이 없습니다.', { type: 'error' });
      return;
    }
    updateMutation.mutate(data as AdminMemberUpdate);
  };

  const handleFieldChange = (key: string, val: string) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const canEdit = editing && isSuperAdmin;

  return (
    <div className="space-y-3 rounded border border-neutral-border bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">회원 정보</h2>
        {isSuperAdmin && (
          <button
            type="button"
            className="rounded border border-brand-700 px-3 py-1 text-xs text-brand-700 hover:bg-brand-50"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? '취소' : '수정'}
          </button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {INFO_FIELDS.map((f) => (
          <div key={f.key}>
            <p className="text-xs text-text-muted">{f.label}</p>
            <FieldInput
              field={f}
              value={form[f.key] ?? ''}
              editing={canEdit}
              displayValue={getMemberFieldValue(member, f.key)}
              onChange={handleFieldChange}
            />
          </div>
        ))}
      </div>
      {canEdit && (
        <div className="flex justify-end pt-2">
          <button
            type="button"
            className="rounded bg-brand-700 px-4 py-1.5 text-xs text-white disabled:opacity-40"
            disabled={updateMutation.isPending || requiredEmpty}
            onClick={handleSave}
          >
            저장
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- 메인 컨텐츠 ---------- */

function MemberDetailContent() {
  const params = useParams();
  const memberId = Number(params.id);
  const { show } = useToast();
  const queryClient = useQueryClient();
  const { data: session } = useAuth();
  const isSuperAdmin = isSuperAdminSession(session);
  const [draftRoles, setDraftRoles] = useState<string[]>([]);

  const memberQuery = useQuery({
    queryKey: ['members', memberId],
    queryFn: () => getMember(memberId),
    enabled: !isNaN(memberId),
  });

  const member = memberQuery.data;

  useEffect(() => {
    if (member) setDraftRoles(parseMemberRoles(member));
  }, [member]);

  const rolesMutation = useMutation({
    mutationFn: (roles: string[]) => updateMemberRoles(memberId, roles),
    onSuccess: (response) => {
      // 서버 응답 기준으로 draft 재동기화
      setDraftRoles(response.roles);
      show('역할을 저장했습니다.', { type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['members', memberId] });
    },
    onError: (error: unknown) => {
      const msg = error instanceof ApiError
        ? apiErrorToMessage(error.code, error.message)
        : '역할 저장 중 오류가 발생했습니다.';
      show(msg, { type: 'error' });
    },
  });

  const handleToggleRole = useCallback((_id: string, role: string, checked: boolean) => {
    setDraftRoles((prev) => applyRoleHierarchy(prev, role, checked));
  }, []);

  if (isNaN(memberId)) {
    return <p className="p-6 text-sm text-state-error">유효하지 않은 회원 ID입니다.</p>;
  }
  if (memberQuery.isLoading) {
    return <p className="p-6 text-sm text-text-muted">로딩 중...</p>;
  }
  if (memberQuery.isError || !member) {
    return <p className="p-6 text-sm text-state-error">회원 정보를 불러오지 못했습니다.</p>;
  }

  const currentRoles = parseMemberRoles(member);
  const rolesDirty = normalizeRoles(draftRoles).sort().join(',')
    !== normalizeRoles(currentRoles).sort().join(',');

  return (
    <section className="space-y-6 p-6">
      <Link
        href="/admin/members"
        className="text-sm text-brand-700 no-underline hover:underline"
      >
        &larr; 회원 목록
      </Link>

      <header>
        <h1 className="text-xl font-semibold text-text-primary">
          {member.name} ({member.student_id})
        </h1>
        <p className="text-sm text-text-secondary">
          {member.cohort}기 · {member.status}
        </p>
      </header>

      <ProfileSection member={member} isSuperAdmin={isSuperAdmin} memberId={memberId} />

      {/* 역할 관리 */}
      <div className="space-y-3 rounded border border-neutral-border bg-white p-4">
        <h2 className="text-sm font-semibold text-text-primary">역할 관리</h2>
        <RoleChecklist
          id={String(member.id)}
          draftRoles={draftRoles}
          disabled={!isSuperAdmin || rolesMutation.isPending}
          onToggle={handleToggleRole}
        />
        {isSuperAdmin && (
          <div className="flex justify-end">
            <button
              type="button"
              className="rounded bg-brand-700 px-4 py-1.5 text-xs text-white disabled:opacity-40"
              disabled={!rolesDirty || rolesMutation.isPending}
              onClick={() => rolesMutation.mutate(draftRoles)}
            >
              역할 저장
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export default function AdminMemberDetailPage() {
  return (
    <RequirePermission
      permission="admin_roles"
      fallback={<div className="p-6 text-sm text-text-secondary">해당 화면 접근 권한이 없습니다.</div>}
    >
      <MemberDetailContent />
    </RequirePermission>
  );
}
