"use client";

import { Suspense, useEffect, useState } from 'react';
import type { Route } from 'next';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { listMembers, countMembers } from '../../services/members';
import { useRouter, useSearchParams } from 'next/navigation';

type Filters = { q: string; cohort: string; major: string; company: string; industry: string; region: string };

function FilterBar({ values, onChange }: { values: Filters; onChange: (f: Filters) => void }) {
  const { q, cohort, major, company, industry, region } = values;
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <input className="rounded border px-3 py-2" placeholder="검색" value={q} onChange={(e) => onChange({ ...values, q: e.target.value })} />
      <input className="rounded border px-3 py-2" placeholder="기수" value={cohort} onChange={(e) => onChange({ ...values, cohort: e.target.value })} />
      <input className="rounded border px-3 py-2" placeholder="전공" value={major} onChange={(e) => onChange({ ...values, major: e.target.value })} />
      <input className="rounded border px-3 py-2" placeholder="회사" value={company} onChange={(e) => onChange({ ...values, company: e.target.value })} />
      <input className="rounded border px-3 py-2" placeholder="업종" value={industry} onChange={(e) => onChange({ ...values, industry: e.target.value })} />
      <input className="rounded border px-3 py-2" placeholder="지역(주소)" value={region} onChange={(e) => onChange({ ...values, region: e.target.value })} />
    </div>
  );
}

function DirectoryResults({
  items,
  hasNext,
  isFetchingNext,
  fetchNext,
}: {
  items: Awaited<ReturnType<typeof listMembers>>;
  hasNext: boolean;
  isFetchingNext: boolean;
  fetchNext: () => void;
}) {
  if (items.length === 0) {
    return <div className="text-sm text-slate-500">검색 결과가 없습니다.</div>;
  }
  return (
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
          {items.map((m) => (
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
        {hasNext ? (
          <button onClick={fetchNext} disabled={isFetchingNext} className="rounded border px-3 py-2 text-sm">
            더 불러오기
          </button>
        ) : (
          <span className="text-xs text-slate-500">더 이상 결과가 없습니다.</span>
        )}
      </div>
    </div>
  );
}

function DirectoryBody({
  isLoading,
  isError,
  items,
  hasNext,
  isFetchingNext,
  fetchNext,
}: {
  isLoading: boolean;
  isError: boolean;
  items: Awaited<ReturnType<typeof listMembers>>;
  hasNext: boolean;
  isFetchingNext: boolean;
  fetchNext: () => void;
}) {
  if (isLoading) return <div className="text-sm text-slate-500">로딩 중…</div>;
  if (isError)
    return <div className="text-sm text-red-600">목록을 불러오지 못했습니다.</div>;
  return (
    <DirectoryResults
      items={items}
      hasNext={hasNext}
      isFetchingNext={isFetchingNext}
      fetchNext={fetchNext}
    />
  );
}

function DirectoryPageInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [cohort, setCohort] = useState<string>(sp.get('cohort') ?? '');
  const [major, setMajor] = useState(sp.get('major') ?? '');
  const [company, setCompany] = useState(sp.get('company') ?? '');
  const [industry, setIndustry] = useState(sp.get('industry') ?? '');
  const [region, setRegion] = useState(sp.get('region') ?? '');

  // 간단 디바운스(400ms)로 입력 변경 시 네트워크 부하와 리렌더를 완화
  const debounceMs = 400;
  const [qDeb, setQDeb] = useState(q);
  const [cohortDeb, setCohortDeb] = useState(cohort);
  const [majorDeb, setMajorDeb] = useState(major);
  const [companyDeb, setCompanyDeb] = useState(company);
  const [industryDeb, setIndustryDeb] = useState(industry);
  const [regionDeb, setRegionDeb] = useState(region);
  useEffect(() => {
    const t = setTimeout(() => setQDeb(q), debounceMs);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const t = setTimeout(() => setCohortDeb(cohort), debounceMs);
    return () => clearTimeout(t);
  }, [cohort]);
  useEffect(() => {
    const t = setTimeout(() => setMajorDeb(major), debounceMs);
    return () => clearTimeout(t);
  }, [major]);
  useEffect(() => {
    const t = setTimeout(() => setCompanyDeb(company), debounceMs);
    return () => clearTimeout(t);
  }, [company]);
  useEffect(() => {
    const t = setTimeout(() => setIndustryDeb(industry), debounceMs);
    return () => clearTimeout(t);
  }, [industry]);
  useEffect(() => {
    const t = setTimeout(() => setRegionDeb(region), debounceMs);
    return () => clearTimeout(t);
  }, [region]);
  const pageSize = 10;
  const query = useInfiniteQuery({
    queryKey: ['directory', qDeb, cohortDeb, majorDeb, companyDeb, industryDeb, regionDeb],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      listMembers({
        q: qDeb,
        cohort: cohortDeb ? Number(cohortDeb) : undefined,
        major: majorDeb,
        company: companyDeb || undefined,
        industry: industryDeb || undefined,
        region: regionDeb || undefined,
        limit: pageSize,
        offset: pageParam as number,
      }),
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.length < pageSize ? undefined : (lastPageParam as number) + pageSize,
  });

  const total = useQuery<number>({
    queryKey: ['directory-count', qDeb, cohortDeb, majorDeb, companyDeb, industryDeb, regionDeb],
    queryFn: () => countMembers({ q: qDeb, cohort: cohortDeb ? Number(cohortDeb) : undefined, major: majorDeb, company: companyDeb || undefined, industry: industryDeb || undefined, region: regionDeb || undefined }),
  });

  // 입력 변경 시 URL 쿼리 자동 동기화(디바운스 적용 상태 사용)
  useEffect(() => {
    const usp = new URLSearchParams();
    if (qDeb) usp.set('q', qDeb);
    if (cohortDeb) usp.set('cohort', cohortDeb);
    if (majorDeb) usp.set('major', majorDeb);
    if (companyDeb) usp.set('company', companyDeb);
    if (industryDeb) usp.set('industry', industryDeb);
    if (regionDeb) usp.set('region', regionDeb);
    const qs = usp.toString();
    const target = `/directory${qs ? `?${qs}` : ''}`;
    // 현재 URL과 동일하면 불필요한 replace를 생략
    if (typeof window !== 'undefined') {
      const current = window.location.pathname + window.location.search;
      // 동적 쿼리 문자열 조합: '/directory' 기준이므로 안전한 경로
      if (current !== target) router.replace(target as Route);
    } else {
      router.replace(target as Route);
    }
  }, [qDeb, cohortDeb, majorDeb, companyDeb, industryDeb, regionDeb, router]);

  const items = (query.data?.pages.flatMap((p) => p) ?? []);
  const filters: Filters = { q, cohort, major, company, industry, region };
  return (
    <div className="p-6">
      <h2 className="mb-4 text-xl font-semibold">수첩(디렉터리)</h2>
      <div className="mb-2 text-sm text-slate-600">총 {total.data ?? 0}명</div>
      <FilterBar values={filters} onChange={(f) => { setQ(f.q); setCohort(f.cohort); setMajor(f.major); setCompany(f.company); setIndustry(f.industry); setRegion(f.region); }} />
      <DirectoryBody
        isLoading={query.isLoading}
        isError={query.isError as boolean}
        items={items}
        hasNext={!!query.hasNextPage}
        isFetchingNext={query.isFetchingNextPage}
        fetchNext={() => query.fetchNextPage()}
      />
    </div>
  );
}

export default function DirectoryPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">로딩 중…</div>}>
      <DirectoryPageInner />
    </Suspense>
  );
}
