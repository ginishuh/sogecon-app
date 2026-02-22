"use client";

import Link from 'next/link';
import type { Route } from 'next';
import { KNOWN_ROLE_SET, RoleChecklist, normalizeRoles } from './role-shared';
import { UnknownRoleHint, SaveRoleButton } from './member-parts';
import type { Member } from '../../../services/members';

export function memberRoles(m: Member): string[] {
  const raw = (m as Record<string, unknown>)['roles'];
  if (typeof raw === 'string') return normalizeRoles(raw.split(','));
  if (Array.isArray(raw)) return normalizeRoles(raw as string[]);
  return ['member'];
}

export function isSameRoleSet(left: string[], right: string[]): boolean {
  const a = normalizeRoles(left).sort();
  const b = normalizeRoles(right).sort();
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

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
    <article className="rounded border border-neutral-border bg-white p-3 md:hidden">
      <Link
        href={`/admin/members/${row.id}` as Route}
        className="font-medium text-text-primary hover:text-brand-700 no-underline hover:underline"
      >
        {row.student_id}
      </Link>
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
  );
}

export function MembersBody({
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
                    <Link
                      href={`/admin/members/${row.id}` as Route}
                      className="font-medium text-text-primary hover:text-brand-700 no-underline hover:underline"
                    >
                      {row.student_id}
                    </Link>
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
