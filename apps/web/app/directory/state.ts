import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { Route } from 'next';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { countMembers, listMembers, type MemberListSort } from '../../services/members';

export const PAGE_SIZE = 10;
export const DEBOUNCE_MS = 350;

export type TextFilterKeys = 'q' | 'cohort' | 'major' | 'company' | 'industry' | 'region' | 'jobTitle';

export type SortOption = MemberListSort;

export type FilterState = {
  q: string;
  cohort: string;
  major: string;
  company: string;
  industry: string;
  region: string;
  jobTitle: string;
  sort: SortOption;
  page: number;
};

export const DEFAULT_FILTERS: FilterState = {
  q: '',
  cohort: '',
  major: '',
  company: '',
  industry: '',
  region: '',
  jobTitle: '',
  sort: 'recent',
  page: 0,
};

export const FILTER_FIELDS: Array<{
  key: TextFilterKeys;
  label: string;
  placeholder: string;
  inputMode?: 'numeric' | 'search';
}> = [
  { key: 'q', label: '검색어', placeholder: '이름/이메일/회사', inputMode: 'search' },
  { key: 'cohort', label: '기수', placeholder: '예: 10', inputMode: 'numeric' },
  { key: 'major', label: '전공', placeholder: '전공' },
  { key: 'company', label: '회사', placeholder: '근무지' },
  { key: 'industry', label: '업종', placeholder: '산업' },
  { key: 'region', label: '지역', placeholder: '거주지' },
  { key: 'jobTitle', label: '직함', placeholder: '직무/직책' },
];

export const SORT_LABELS: Record<SortOption, string> = {
  recent: '최근 업데이트',
  cohort_desc: '기수 내림차순',
  cohort_asc: '기수 오름차순',
  name: '이름순 (가나다)',
};

export function clampPage(value: number): number {
  if (Number.isNaN(value) || value < 0) return 0;
  if (!Number.isFinite(value)) return 0;
  return Math.floor(value);
}

export function readFilters(params: URLSearchParams): FilterState {
  const pageParam = params.get('page');
  const sortParam = params.get('sort');
  const allowedSorts: SortOption[] = ['recent', 'cohort_desc', 'cohort_asc', 'name'];
  const isAllowedSort = (value: string | null): value is SortOption =>
    Boolean(value && allowedSorts.includes(value as SortOption));
  return {
    q: params.get('q') ?? '',
    cohort: params.get('cohort') ?? '',
    major: params.get('major') ?? '',
    company: params.get('company') ?? '',
    industry: params.get('industry') ?? '',
    region: params.get('region') ?? '',
    jobTitle: params.get('job_title') ?? '',
    sort: isAllowedSort(sortParam) ? (sortParam as SortOption) : 'recent',
    page: pageParam ? clampPage(Number(pageParam)) : 0,
  };
}

export function buildUrl(filters: FilterState): string {
  const usp = new URLSearchParams();
  const stringParams: Record<string, string> = {
    q: filters.q,
    cohort: filters.cohort,
    major: filters.major,
    company: filters.company,
    industry: filters.industry,
    region: filters.region,
    job_title: filters.jobTitle,
  };
  Object.entries(stringParams).forEach(([key, value]) => {
    if (value) {
      usp.set(key, value);
    }
  });
  if (filters.sort !== 'recent') usp.set('sort', filters.sort);
  if (filters.page > 0) usp.set('page', String(filters.page));
  const qs = usp.toString();
  return `/directory${qs ? `?${qs}` : ''}`;
}

export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(handle);
  }, [value, delay]);
  return debounced;
}

export type MemberListPage = Awaited<ReturnType<typeof listMembers>>;

type UrlSyncResult = {
  filters: FilterState;
  debouncedFilters: FilterState;
  updateFilter: (key: TextFilterKeys, next: string) => void;
  updateSort: (next: SortOption) => void;
  resetFilters: () => void;
  setPage: (page: number) => void;
  sharePath: string;
  copied: boolean;
  copyShareLink: () => Promise<void> | void;
};

export function useDirectoryUrlSync(): UrlSyncResult {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const filtersFromUrl = useMemo(
    () => readFilters(new URLSearchParams(searchParamsKey)),
    [searchParamsKey]
  );
  const [filters, setFilters] = useState<FilterState>(filtersFromUrl);
  const lastSyncedParamsRef = useRef(searchParamsKey);
  const copyTimeoutRef = useRef<number | null>(null);
  const [copied, setCopied] = useState(false);

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

  const updateFilter = useCallback((key: TextFilterKeys, nextValue: string) => {
    setFilters((prev) => {
      if (prev[key] === nextValue) {
        return prev;
      }
      return {
        ...prev,
        [key]: nextValue,
        page: 0,
      };
    });
  }, []);

  const updateSort = useCallback((nextSort: SortOption) => {
    setFilters((prev) => {
      if (prev.sort === nextSort) {
        return prev;
      }
      return {
        ...prev,
        sort: nextSort,
        page: 0,
      };
    });
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS });
  }, []);

  const setPage = useCallback((page: number) => {
    setFilters((prev) => {
      const nextPage = clampPage(page);
      if (prev.page === nextPage) {
        return prev;
      }
      return { ...prev, page: nextPage };
    });
  }, []);

  const sharePath = useMemo(() => buildUrl(debouncedFilters), [debouncedFilters]);
  const shareFullUrl = useMemo(() => {
    if (typeof window === 'undefined') {
      return sharePath;
    }
    return `${window.location.origin}${sharePath}`;
  }, [sharePath]);

  const copyShareLink = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      return;
    }
    try {
      await navigator.clipboard.writeText(shareFullUrl);
      setCopied(true);
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [shareFullUrl]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  return {
    filters,
    debouncedFilters,
    updateFilter,
    updateSort,
    resetFilters,
    setPage,
    sharePath,
    copied,
    copyShareLink,
  };
}

type DirectoryQueriesResult = {
  membersQuery: ReturnType<typeof useInfiniteQuery<MemberListPage>>;
  visibleItems: MemberListPage;
  totalLabel: string;
  displayedCount: number;
  currentPage: number;
  totalPages: number | null;
  loadMoreLabel: string;
  sortOption: SortOption;
};

export function useDirectoryQueries(debouncedFilters: FilterState): DirectoryQueriesResult {
  const filtersForQuery = useMemo(() => {
    return {
      q: debouncedFilters.q || undefined,
      cohort: debouncedFilters.cohort ? Number(debouncedFilters.cohort) : undefined,
      major: debouncedFilters.major || undefined,
      company: debouncedFilters.company || undefined,
      industry: debouncedFilters.industry || undefined,
      region: debouncedFilters.region || undefined,
      jobTitle: debouncedFilters.jobTitle || undefined,
    };
  }, [debouncedFilters]);

  const sortOption = debouncedFilters.sort;

  const membersQuery = useInfiniteQuery<MemberListPage>({
    queryKey: [
      'directory',
      filtersForQuery.q,
      filtersForQuery.cohort,
      filtersForQuery.major,
      filtersForQuery.company,
      filtersForQuery.industry,
      filtersForQuery.region,
      filtersForQuery.jobTitle,
      sortOption,
    ],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      listMembers({
        ...filtersForQuery,
        sort: sortOption,
        limit: PAGE_SIZE,
        offset: pageParam as number,
      }),
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.length < PAGE_SIZE ? undefined : ((lastPageParam as number) + PAGE_SIZE),
    placeholderData: keepPreviousData,
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
      filtersForQuery.jobTitle,
    ],
    queryFn: () =>
      countMembers({
        q: filtersForQuery.q,
        cohort: filtersForQuery.cohort,
        major: filtersForQuery.major,
        company: filtersForQuery.company,
        industry: filtersForQuery.industry,
        region: filtersForQuery.region,
        jobTitle: filtersForQuery.jobTitle,
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

  const totalCount = totalQuery.data ?? null;
  const displayedCount = visibleItems.length;
  const currentPage = debouncedFilters.page + 1;
  const totalPages = totalCount ? Math.max(1, Math.ceil(totalCount / PAGE_SIZE)) : null;
  const loadMoreLabel = totalPages
    ? `더 불러오기 (다음 ${Math.min(currentPage + 1, totalPages)} / ${totalPages})`
    : '더 불러오기';
  const totalLabel = totalQuery.isPending
    ? '…'
    : totalQuery.isError
    ? '—'
    : (totalCount ?? 0).toLocaleString();

  return {
    membersQuery,
    visibleItems,
    totalLabel,
    displayedCount,
    currentPage,
    totalPages,
    loadMoreLabel,
    sortOption,
  };
}

type InfiniteLoaderResult = {
  handleLoadMore: () => void;
  sentinelRef: React.MutableRefObject<HTMLDivElement | null>;
};

export function useInfiniteLoader(
  membersQuery: ReturnType<typeof useInfiniteQuery<MemberListPage>>,
  currentPage: number,
  setPage: (page: number) => void
): InfiniteLoaderResult {
  const handleLoadMore = useCallback(() => {
    if (!membersQuery.hasNextPage || membersQuery.isFetchingNextPage) {
      return;
    }
    setPage(currentPage + 1);
    void membersQuery.fetchNextPage();
  }, [currentPage, membersQuery, setPage]);

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

  return { handleLoadMore, sentinelRef };
}
