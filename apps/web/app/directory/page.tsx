"use client";

import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { listMembers } from '../../services/members';

export default function DirectoryPage() {
  const [q, setQ] = useState('');
  const [cohort, setCohort] = useState<string>('');
  const [major, setMajor] = useState('');
  const pageSize = 10;
  const query = useInfiniteQuery({
    queryKey: ['directory', q, cohort, major],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      listMembers({
        q,
        cohort: cohort ? Number(cohort) : undefined,
        major,
        limit: pageSize,
        offset: pageParam as number,
      }),
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.length < pageSize ? undefined : (lastPageParam as number) + pageSize,
  });

  return (
    <div className="p-6">
      <h2 className="mb-4 text-xl font-semibold">수첩(디렉터리)</h2>
      <div className="mb-4 flex flex-wrap gap-2">
        <input className="rounded border px-3 py-2" placeholder="검색" value={q} onChange={(e) => setQ(e.target.value)} />
        <input className="rounded border px-3 py-2" placeholder="기수" value={cohort} onChange={(e) => setCohort(e.target.value)} />
        <input className="rounded border px-3 py-2" placeholder="전공" value={major} onChange={(e) => setMajor(e.target.value)} />
      </div>
      {query.isLoading ? (
        <div className="text-sm text-slate-500">로딩 중…</div>
      ) : query.isError ? (
        <div className="text-sm text-red-600">목록을 불러오지 못했습니다.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[600px] text-left text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="p-2">이름</th>
                <th className="p-2">이메일</th>
                <th className="p-2">기수</th>
                <th className="p-2">전공</th>
                <th className="p-2">공개</th>
              </tr>
            </thead>
            <tbody>
              {(query.data?.pages.flatMap((p) => p) ?? []).map((m) => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="p-2">{m.name}</td>
                  <td className="p-2 font-mono text-xs">{m.email}</td>
                  <td className="p-2">{m.cohort}</td>
                  <td className="p-2">{m.major ?? '-'}</td>
                  <td className="p-2">{m.visibility}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3">
            {query.hasNextPage ? (
              <button
                onClick={() => query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
                className="rounded border px-3 py-2 text-sm"
              >더 불러오기</button>
            ) : (
              <span className="text-xs text-slate-500">더 이상 결과가 없습니다.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
