"use client";

import { useEffect, useState, type FormEvent } from 'react';
import type { DirectMemberCreatePayload } from '../../../services/admin-members';
import { RoleChecklist, applyRoleHierarchy } from './role-shared';

function parseCohortValue(rawValue: string): number | null {
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed)) return null;
  if (parsed < 1 || parsed > 9999) return null;
  return parsed;
}

export function DirectMemberCreateForm({
  isPending,
  resetKey,
  onSubmit,
}: {
  isPending: boolean;
  resetKey: number;
  onSubmit: (payload: DirectMemberCreatePayload) => void;
}) {
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [cohort, setCohort] = useState('');
  const [roles, setRoles] = useState<string[]>(['member']);

  useEffect(() => {
    setStudentId('');
    setEmail('');
    setName('');
    setCohort('');
    setRoles(['member']);
  }, [resetKey]);

  const toggleRole = (role: string, checked: boolean) => {
    setRoles((prev) => applyRoleHierarchy(prev, role, checked));
  };

  const hasRequiredText =
    studentId.trim().length > 0 &&
    email.trim().length > 0 &&
    name.trim().length > 0 &&
    cohort.trim().length > 0;
  const cohortValue = parseCohortValue(cohort);
  const canSubmit =
    hasRequiredText &&
    cohortValue !== null &&
    roles.length > 0;

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit || isPending || cohortValue === null) return;
    onSubmit({
      student_id: studentId.trim(),
      email: email.trim(),
      name: name.trim(),
      cohort: cohortValue,
      roles,
    });
  };

  const handleChecklistToggle = (_id: string, role: string, checked: boolean) => {
    toggleRole(role, checked);
  };

  return (
    <form
      className="space-y-3 rounded border border-neutral-border bg-white p-4"
      onSubmit={handleFormSubmit}
    >
      <h2 className="text-sm font-semibold text-text-primary">
        직접 회원 생성 (super_admin 전용)
      </h2>
      <p className="text-xs text-text-muted">
        생성 후 활성화 링크가 발급됩니다. 회원에게 전달하면 비밀번호를 설정할 수 있습니다.
      </p>
      <div className="grid gap-2 md:grid-cols-2">
        <label className="text-xs text-text-secondary">
          학번
          <input
            className="mt-1 w-full rounded border border-neutral-border px-2 py-1 text-sm text-text-primary"
            value={studentId}
            onChange={(e) => setStudentId(e.currentTarget.value)}
            placeholder="s12345"
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
            placeholder="user@example.com"
            disabled={isPending}
          />
        </label>
        <label className="text-xs text-text-secondary">
          이름
          <input
            className="mt-1 w-full rounded border border-neutral-border px-2 py-1 text-sm text-text-primary"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="홍길동"
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

      <div className="space-y-1">
        <p className="text-xs text-text-secondary">초기 권한</p>
        <RoleChecklist
          id="new-member"
          draftRoles={roles}
          disabled={isPending}
          onToggle={handleChecklistToggle}
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded bg-brand-700 px-3 py-1.5 text-xs text-white disabled:opacity-40"
          disabled={!canSubmit || isPending}
        >
          회원 생성
        </button>
      </div>
    </form>
  );
}
