"use client";

import { useState } from 'react';

export default function DirectoryPage() {
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState({ cohort: '', major: '', region: '', industry: '' });

  return (
    <div className="p-6">
      <h2 className="mb-4 text-xl font-semibold">수첩(디렉터리) — 스켈레톤</h2>
      <div className="mb-4 flex flex-wrap gap-2">
        <input className="rounded border px-3 py-2" placeholder="검색" value={q} onChange={(e) => setQ(e.target.value)} />
        <input className="rounded border px-3 py-2" placeholder="기수" value={filters.cohort} onChange={(e) => setFilters({ ...filters, cohort: e.target.value })} />
        <input className="rounded border px-3 py-2" placeholder="전공" value={filters.major} onChange={(e) => setFilters({ ...filters, major: e.target.value })} />
        <input className="rounded border px-3 py-2" placeholder="지역" value={filters.region} onChange={(e) => setFilters({ ...filters, region: e.target.value })} />
        <input className="rounded border px-3 py-2" placeholder="업종" value={filters.industry} onChange={(e) => setFilters({ ...filters, industry: e.target.value })} />
        <button className="rounded border px-3 py-2 text-sm">검색</button>
      </div>
      <div className="rounded border p-4 text-sm text-slate-600">목록/상세 API 준비 중입니다. 필터 UI만 우선 제공합니다.</div>
    </div>
  );
}

