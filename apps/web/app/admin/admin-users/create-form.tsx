"use client";

import { useEffect, useState, type FormEvent } from 'react';
import { type AdminUserCreatePayload } from '../../../services/admin-users';
import { RoleChecklist, normalizeRoles } from './role-shared';

function parseCohortValue(rawValue: string): number | null {
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed)) return null;
  if (parsed < 1 || parsed > 9999) return null;
  return parsed;
}

function hasAdminGradeRole(roles: string[]): boolean {
  return roles.includes('admin') || roles.includes('super_admin');
}

function AdminGradeHint({ hasAdminGrade }: { hasAdminGrade: boolean }) {
  if (hasAdminGrade) return null;
  return <p className="text-xs text-state-warning">최소 하나의 관리자 등급(admin 또는 super_admin)이 필요합니다.</p>;
}

export function AdminUserCreateForm({
  isPending,
  resetKey,
  onSubmit,
}: {
  isPending: boolean;
  resetKey: number;
  onSubmit: (payload: AdminUserCreatePayload) => void;
}) {
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [cohort, setCohort] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [roles, setRoles] = useState<string[]>(['member', 'admin']);

  useEffect(() => {
    setStudentId('');
    setEmail('');
    setName('');
    setCohort('');
    setTemporaryPassword('');
    setRoles(['member', 'admin']);
  }, [resetKey]);

  const toggleRole = (role: string, checked: boolean) => {
    setRoles((prev) => {
      const without = prev.filter((token) => token !== role);
      return checked ? normalizeRoles([...without, role]) : without;
    });
  };

  const hasRequiredText =
    studentId.trim().length > 0 &&
    email.trim().length > 0 &&
    name.trim().length > 0 &&
    cohort.trim().length > 0;
  const cohortValue = parseCohortValue(cohort);
  const hasAdminGrade = hasAdminGradeRole(roles);
  const canSubmit =
    hasRequiredText &&
    temporaryPassword.length >= 8 &&
    cohortValue !== null &&
    roles.length > 0 &&
    hasAdminGrade;

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit || isPending || cohortValue === null) return;
    onSubmit({
      student_id: studentId.trim(),
      email: email.trim(),
      name: name.trim(),
      cohort: cohortValue,
      temporary_password: temporaryPassword,
      roles,
    });
  };

  const handleChecklistToggle = (sid: string, role: string, checked: boolean) => {
    void sid;
    toggleRole(role, checked);
  };

  return (
    <form
      className="space-y-3 rounded border border-neutral-border bg-white p-4"
      onSubmit={handleFormSubmit}
    >
      <h2 className="text-sm font-semibold text-text-primary">신규 관리자 계정 생성 (super_admin 전용)</h2>
      <div className="grid gap-2 md:grid-cols-2">
        <label className="text-xs text-text-secondary">
          학번
          <input
            className="mt-1 w-full rounded border border-neutral-border px-2 py-1 text-sm text-text-primary"
            value={studentId}
            onChange={(e) => setStudentId(e.currentTarget.value)}
            placeholder="admin003"
            disabled={isPending}
          />
        </label>
        <label className="text-xs text-text-secondary">
          이메일
          <input
            type="email"
            className="mt-1 w-full rounded border border-neutral-border px-2 py-1 text-sm text-text-primary"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            placeholder="admin003@sogecon.kr"
            disabled={isPending}
          />
        </label>
        <label className="text-xs text-text-secondary">
          이름
          <input
            className="mt-1 w-full rounded border border-neutral-border px-2 py-1 text-sm text-text-primary"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="신규 관리자"
            disabled={isPending}
          />
        </label>
        <label className="text-xs text-text-secondary">
          기수
          <input
            type="number"
            className="mt-1 w-full rounded border border-neutral-border px-2 py-1 text-sm text-text-primary"
            value={cohort}
            onChange={(e) => setCohort(e.currentTarget.value)}
            placeholder="60"
            disabled={isPending}
          />
        </label>
      </div>

      <label className="block text-xs text-text-secondary">
        임시 비밀번호 (8자 이상)
        <input
          type="password"
          className="mt-1 w-full rounded border border-neutral-border px-2 py-1 text-sm text-text-primary"
          value={temporaryPassword}
          onChange={(e) => setTemporaryPassword(e.currentTarget.value)}
          placeholder="초기 비밀번호 입력"
          disabled={isPending}
        />
      </label>

      <div className="space-y-1">
        <p className="text-xs text-text-secondary">초기 권한</p>
        <RoleChecklist
          studentId="new-admin"
          draftRoles={roles}
          disabled={isPending}
          onToggle={handleChecklistToggle}
        />
        <AdminGradeHint hasAdminGrade={hasAdminGrade} />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded bg-brand-700 px-3 py-1.5 text-xs text-white disabled:opacity-40"
          disabled={!canSubmit || isPending}
        >
          관리자 생성
        </button>
      </div>
    </form>
  );
}
