"use client";

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RequireAdmin } from '../../../components/require-admin';
import { useAuth } from '../../../hooks/useAuth';
import {
  listAdminSupportTickets,
  type SupportTicketRead,
} from '../../../services/support';

function formatDate(value: string): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('ko-KR');
}

function filterTickets(items: SupportTicketRead[], query: string): SupportTicketRead[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const haystack = [
      item.subject,
      item.body,
      item.member_email ?? '',
      item.contact ?? '',
      item.client_ip ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

function AdminSupportPageContent() {
  const [limit, setLimit] = useState(50);
  const [search, setSearch] = useState('');

  const query = useQuery({
    queryKey: ['admin-support-tickets', limit],
    queryFn: () => listAdminSupportTickets(limit),
    staleTime: 10_000,
  });

  const items = useMemo(
    () => filterTickets(query.data ?? [], search),
    [query.data, search]
  );

  return (
    <div className="space-y-4 p-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">문의 내역</h2>
        <p className="text-sm text-text-secondary">
          회원이 제출한 문의를 최근순으로 확인합니다.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded border border-neutral-border bg-white p-3">
        <label className="text-xs text-text-secondary">
          조회 개수
          <select
            className="mt-1 block rounded border border-neutral-border px-3 py-2 text-sm"
            value={limit}
            onChange={(e) => setLimit(parseInt(e.currentTarget.value, 10))}
          >
            {[20, 50, 100, 200].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-text-secondary">
          검색
          <input
            className="mt-1 block w-72 rounded border border-neutral-border px-3 py-2 text-sm"
            placeholder="제목/본문/이메일/연락처/IP"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
          />
        </label>
        <button
          type="button"
          className="rounded border border-neutral-border px-3 py-2 text-sm"
          onClick={() => void query.refetch()}
        >
          새로고침
        </button>
      </div>

      {query.isLoading ? (
        <p className="rounded border border-neutral-border bg-white px-3 py-8 text-center text-text-muted">
          로딩 중...
        </p>
      ) : query.isError ? (
        <p className="rounded border border-neutral-border bg-white px-3 py-8 text-center text-state-error">
          문의 내역을 불러오지 못했습니다.
        </p>
      ) : items.length === 0 ? (
        <p className="rounded border border-neutral-border bg-white px-3 py-8 text-center text-text-muted">
          조회 결과가 없습니다.
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-neutral-border bg-white">
          <table className="min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b bg-surface-raised">
                <th className="p-2">접수시각</th>
                <th className="p-2">제목</th>
                <th className="p-2">본문</th>
                <th className="p-2">회원 이메일</th>
                <th className="p-2">연락처</th>
                <th className="p-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b align-top last:border-0">
                  <td className="p-2 text-xs text-text-secondary">
                    {formatDate(item.created_at)}
                  </td>
                  <td className="max-w-[220px] p-2 font-medium text-text-primary">
                    <p className="line-clamp-2 break-words">{item.subject}</p>
                  </td>
                  <td className="max-w-[420px] p-2 text-text-secondary">
                    <p className="whitespace-pre-wrap break-words">{item.body}</p>
                  </td>
                  <td className="p-2 text-text-secondary">{item.member_email ?? '-'}</td>
                  <td className="p-2 text-text-secondary">{item.contact ?? '-'}</td>
                  <td className="p-2 font-mono text-xs text-text-secondary">
                    {item.client_ip ?? '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminSupportPage() {
  const { status } = useAuth();

  if (status !== 'authorized') {
    return (
      <div className="p-4 text-sm text-text-secondary">관리자 로그인이 필요합니다.</div>
    );
  }

  return (
    <RequireAdmin
      fallback={
        <div className="p-4 text-sm text-text-secondary">
          해당 화면 접근 권한이 없습니다.
        </div>
      }
    >
      <AdminSupportPageContent />
    </RequireAdmin>
  );
}
