"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listMembers, type Member } from '../../services/members';

export default function DirectoryPage() {
  const [q, setQ] = useState('');
  const [cohort, setCohort] = useState<string>('');
  const [major, setMajor] = useState('');
  const query = useQuery<Member[]>({
    queryKey: ['directory', q, cohort, major],
    queryFn: () => listMembers({ q, cohort: cohort ? Number(cohort) : undefined, major }),
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
              {(query.data ?? []).map((m) => (
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
        </div>
      )}
    </div>
  );
}
