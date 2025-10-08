"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Route } from 'next';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';

import { listMembers, countMembers } from '../../services/members';

const PAGE_SIZE = 10;
const DEBOUNCE_MS = 350;

type FilterKeys = 'q' | 'cohort' | 'major' | 'company' | 'industry' | 'region';

type FilterState = {
  q: string;
  cohort: string;
  major: string;
  company: string;
  industry: string;
  region: string;
  page: number;
};

const DEFAULT_FILTERS: FilterState = {
  q: '',
  cohort: '',
  major: '',
  company: '',
  industry: '',
  region: '',
  page: 0,
};

const FILTER_FIELDS: Array<{
  key: FilterKeys;
  label: string;
  placeholder: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}> = [
  { key: 'q', label: '검색어', placeholder: '이름/이메일 검색', inputMode: 'search' },
  { key: 'cohort', label: '기수', placeholder: '예: 12', inputMode: 'numeric' },
  { key: 'major', label: '전공', placeholder: '전공' },
  { key: 'company', label: '회사', placeholder: '회사명' },
  { key: 'industry', label: '업종', placeholder: '업종' },
  { key: 'region', label: '지역', placeholder: '주소/지역' },
];

function clampPage(value: number): number {
  if (Number.isNaN(value) || value < 0) return 0;
  if (!Number.isFinite(value)) return 0;
  return Math.floor(value);
}

function readFilters(params: URLSearchParams): FilterState {
  const pageParam = params.get('page');
  return {
    q: params.get('q') ?? '',
    cohort: params.get('cohort') ?? '',
    major: params.get('major') ?? '',
    company: params.get('company') ?? '',
    industry: params.get('industry') ?? '',
    region: params.get('region') ?? '',
    page: pageParam ? clampPage(Number(pageParam)) : 0,
  };
}

function buildUrl(filters: FilterState): string {
  const usp = new URLSearchParams();
  if (filters.q) usp.set('q', filters.q);
  if (filters.cohort) usp.set('cohort', filters.cohort);
  if (filters.major) usp.set('major', filters.major);
  if (filters.company) usp.set('company', filters.company);
  if (filters.industry) usp.set('industry', filters.industry);
  if (filters.region) usp.set('region', filters.region);
  if (filters.page > 0) usp.set('page', String(filters.page));
  const qs = usp.toString();
  return `/directory${qs ? `?${qs}` : ''}`;
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(handle);
  }, [value, delay]);
  return debounced;
}

type DirectoryFiltersProps = {
  value: FilterState;
  onChange: (key: FilterKeys, next: string) => void;
  onReset: () => void;
};

function DirectoryFilters({ value, onChange, onReset }: DirectoryFiltersProps) {
  return (
    <fieldset className="mb-4 flex flex-wrap gap-3" aria-label="디렉터리 검색 필터">
      {FILTER_FIELDS.map(({ key, label, placeholder, inputMode }) => (
        <label key={key} className="flex flex-col text-xs text-slate-600">
          <span className="mb-1 font-medium text-slate-700">{label}</span>
          <input
            inputMode={inputMode}
            className="rounded border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            value={value[key]}
            placeholder={placeholder}
            aria-label={label}
            onChange={(event) => onChange(key, event.target.value)}
          />
        </label>
      ))}
      <button
        type="button"
        onClick={onReset}
        className="self-end rounded border border-slate-300 px-3 py-2 text-sm text-slate-600 transition hover:border-emerald-500 hover:text-emerald-600"
      >
        필터 초기화
      </button>
    </fieldset>
  );
}

function LoadingMessage({ children }: { children: ReactNode }) {
  return (
    <div role="status" aria-live="polite" className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
      {children}
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
      {message}
    </div>
  );
}

function EmptyState() {
  return (
    <div role="status" aria-live="polite" className="rounded border border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-600">
      검색 결과가 없습니다. 필터를 조정하거나 다른 검색어를 입력해보세요.
    </div>
  );
}

function DirectoryResults({
  items,
  onLoadMore,
  hasNext,
  isLoadingMore,
  sentinelRef,
}: {
  items: Awaited<ReturnType<typeof listMembers>>;
  onLoadMore: () => void;
  hasNext: boolean;
  isLoadingMore: boolean;
  sentinelRef: React.MutableRefObject<HTMLDivElement | null>;
}) {
  if (items.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="min-w-[640px] table-fixed border-collapse text-left text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <th className="p-2" scope="col">
                이름
              </th>
              <th className="p-2" scope="col">
                이메일
              </th>
              <th className="p-2" scope="col">
                기수
              </th>
              <th className="p-2" scope="col">
                전공
              </th>
              <th className="p-2" scope="col">
                회사
              </th>
              <th className="p-2" scope="col">
                업종
              </th>
              <th className="p-2" scope="col">
                공개 범위
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id} className="border-b last:border-0">
                <td className="p-2 font-medium text-slate-800">{m.name}</td>
                <td className="p-2 font-mono text-xs text-slate-500">{m.email}</td>
                <td className="p-2">{m.cohort}</td>
                <td className="p-2">{m.major ?? '-'}</td>
                <td className="p-2">{m.company ?? '-'}</td>
                <td className="p-2">{m.industry ?? '-'}</td>
                <td className="p-2 text-xs uppercase text-slate-500">{m.visibility}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col items-center gap-2" ref={sentinelRef}>
        {hasNext ? (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="rounded border border-emerald-500 px-4 py-2 text-sm text-emerald-600 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
          >
            {isLoadingMore ? '불러오는 중…' : '더 불러오기'}
          </button>
        ) : (
          <span className="text-xs text-slate-500">더 이상 결과가 없습니다.</span>
        )}
      </div>
    </div>
  );
}

function DirectoryPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const filtersFromUrl = useMemo(
    () => readFilters(new URLSearchParams(searchParamsKey)),
    [searchParamsKey]
  );
  const [filters, setFilters] = useState<FilterState>(filtersFromUrl);
  const lastSyncedParamsRef = useRef<string>(searchParamsKey);

  useEffect(() => {
    if (lastSyncedParamsRef.current === searchParamsKey) {
      return;
    }
    lastSyncedParamsRef.current = searchParamsKey;
    setFilters(filtersFromUrl);
  }, [filtersFromUrl, searchParamsKey]);

  const debouncedFilters = useDebouncedValue(filters, DEBOUNCE_MS);

  useEffect(() => {
    const currentUrl = buildUrl(filtersFromUrl);
    const targetUrl = buildUrl(debouncedFilters);
    if (currentUrl === targetUrl) {
      return;
    }
    const targetQuery = targetUrl.split('?')[1] ?? '';
    lastSyncedParamsRef.current = targetQuery;
    router.replace(targetUrl as Route, { scroll: false });
  }, [debouncedFilters, filtersFromUrl, router]);

  const updateFilter = useCallback(
    (key: FilterKeys, nextValue: string) => {
      setFilters((prev) => {
        if (prev[key] === nextValue) return prev;
        const next: FilterState = {
          ...prev,
          [key]: nextValue,
          page: 0,
        };
        return next;
      });
    },
    []
  );

  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const setPage = useCallback(
    (page: number) => {
      setFilters((prev) => {
        const nextPage = clampPage(page);
        if (prev.page === nextPage) return prev;
        return { ...prev, page: nextPage };
      });
    },
    []
  );

  const filtersForQuery = useMemo(
    () => ({
      q: debouncedFilters.q || undefined,
      cohort: debouncedFilters.cohort ? Number(debouncedFilters.cohort) : undefined,
      major: debouncedFilters.major || undefined,
      company: debouncedFilters.company || undefined,
      industry: debouncedFilters.industry || undefined,
      region: debouncedFilters.region || undefined,
    }),
    [debouncedFilters]
  );

  const membersQuery = useInfiniteQuery({
    queryKey: [
      'directory',
      filtersForQuery.q,
      filtersForQuery.cohort,
      filtersForQuery.major,
      filtersForQuery.company,
      filtersForQuery.industry,
      filtersForQuery.region,
    ],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      listMembers({
        ...filtersForQuery,
        limit: PAGE_SIZE,
        offset: pageParam as number,
      }),
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.length < PAGE_SIZE ? undefined : ((lastPageParam as number) + PAGE_SIZE),
  });

  const totalQuery = useQuery({
    queryKey: [
      'directory-total',
      filtersForQuery.q,
      filtersForQuery.cohort,
      filtersForQuery.major,
      filtersForQuery.company,
      filtersForQuery.industry,
      filtersForQuery.region,
    ],
    queryFn: () =>
      countMembers({
        q: filtersForQuery.q,
        cohort: filtersForQuery.cohort,
        major: filtersForQuery.major,
        company: filtersForQuery.company,
        industry: filtersForQuery.industry,
        region: filtersForQuery.region,
      }),
  });

  const desiredPageCount = debouncedFilters.page + 1;
  const loadedPages = membersQuery.data?.pages.length ?? 0;
  useEffect(() => {
    if (membersQuery.status !== 'success') return;
    if (membersQuery.isFetchingNextPage) return;
    if (!membersQuery.hasNextPage) return;
    if (loadedPages >= desiredPageCount) return;
    void membersQuery.fetchNextPage();
  }, [desiredPageCount, loadedPages, membersQuery]);

  const visibleItems = useMemo(() => {
    const pages = membersQuery.data?.pages ?? [];
    const limit = Math.min(desiredPageCount, pages.length);
    return pages.slice(0, limit).flat();
  }, [membersQuery.data, desiredPageCount]);

  const handleLoadMore = useCallback(() => {
    if (!membersQuery.hasNextPage || membersQuery.isFetchingNextPage) return;
    setPage(debouncedFilters.page + 1);
    void membersQuery.fetchNextPage();
  }, [debouncedFilters.page, membersQuery, setPage]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const target = sentinelRef.current;
    if (!target) return;
    if (!membersQuery.hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            handleLoadMore();
          }
        });
      },
      { rootMargin: '240px 0px' }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [handleLoadMore, membersQuery.hasNextPage]);

  return (
    <div className="space-y-4 p-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-slate-800">동문 디렉터리</h2>
        <p className="text-sm text-slate-600">
          검색어나 필터를 조합해 동문 정보를 찾아보세요. 공개 범위가 제한된 항목은 표시되지 않을 수 있습니다.
        </p>
      </header>

      <DirectoryFilters
        value={filters}
        onChange={updateFilter}
        onReset={resetFilters}
      />

      <section className="space-y-3" aria-live="polite">
        <p className="text-sm text-slate-600">
          총{' '}
          {totalQuery.isPending ? '…' : totalQuery.isError ? '—' : totalQuery.data?.toLocaleString() ?? '0'}
          명
        </p>
        {membersQuery.isPending ? (
          <LoadingMessage>목록을 불러오는 중입니다…</LoadingMessage>
        ) : membersQuery.isError ? (
          <ErrorMessage message="목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요." />
        ) : (
          <DirectoryResults
            items={visibleItems}
            onLoadMore={handleLoadMore}
            hasNext={Boolean(membersQuery.hasNextPage)}
            isLoadingMore={membersQuery.isFetchingNextPage}
            sentinelRef={sentinelRef}
          />
        )}
      </section>
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
