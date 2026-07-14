"use client";

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AdminAuthState } from '../../../components/admin-auth-state';
import { RequirePermission } from '../../../components/require-permission';
import {
  CONTROL_BASE,
  CONTROL_SIZE,
  CONTROL_VARIANT,
  FIELD_CONTROL,
} from '../../../components/ui/styles';
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

export function SupportFilters({
  limit,
  search,
  onChangeLimit,
  onChangeSearch,
  onRefresh,
}: {
  limit: number;
  search: string;
  onChangeLimit: (value: number) => void;
  onChangeSearch: (value: string) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded border border-neutral-border bg-white p-3">
      <label className="min-w-24 text-xs text-text-secondary">
        조회 개수
        <select
          className={`${FIELD_CONTROL} mt-1 text-sm`}
          value={limit}
          onChange={(event) => onChangeLimit(parseInt(event.currentTarget.value, 10))}
        >
          {[20, 50, 100, 200].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label className="min-w-0 flex-1 text-xs text-text-secondary sm:max-w-72">
        검색
        <input
          className={`${FIELD_CONTROL} mt-1 text-sm`}
          placeholder="제목/본문/이메일/연락처/IP"
          value={search}
          onChange={(event) => onChangeSearch(event.currentTarget.value)}
        />
      </label>
      <button
        type="button"
        className={`${CONTROL_BASE} ${CONTROL_SIZE.sm} ${CONTROL_VARIANT.secondary}`}
        onClick={onRefresh}
      >
        새로고침
      </button>
    </div>
  );
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

      <SupportFilters
        limit={limit}
        search={search}
        onChangeLimit={setLimit}
        onChangeSearch={setSearch}
        onRefresh={() => void query.refetch()}
      />

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
                    <p className="line-clamp-2 wrap-break-word">{item.subject}</p>
                  </td>
                  <td className="max-w-[420px] p-2 text-text-secondary">
                    <p
                      className="line-clamp-3 whitespace-pre-wrap wrap-break-word"
                      title={item.body}
                    >
                      {item.body}
                    </p>
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
    return <AdminAuthState status={status} />;
  }

  return (
    <RequirePermission
      permission="admin_support"
      fallback={
        <div className="p-4 text-sm text-text-secondary">
          해당 화면 접근 권한이 없습니다.
        </div>
      }
    >
      <AdminSupportPageContent />
    </RequirePermission>
  );
}
