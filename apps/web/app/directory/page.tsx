"use client";

import React, { Suspense, useState, type ReactNode } from 'react';

import {
  FILTER_FIELDS,
  SORT_LABELS,
  type FilterState,
  type SortOption,
  type TextFilterKeys,
  type MemberListPage,
  useDirectoryQueries,
  useDirectoryUrlSync,
  useInfiniteLoader,
} from './state';
import DirectoryCard from '../../components/directory-card';
import Accordion from '../../components/ui/accordion';
import Button from '../../components/ui/button';

type DirectoryFiltersProps = {
  value: FilterState;
  onChange: (key: TextFilterKeys, next: string) => void;
  onReset: () => void;
  onSortChange: (next: SortOption) => void;
};

function DirectoryFilters({ value, onChange, onReset, onSortChange }: DirectoryFiltersProps) {
  // autoComplete 힌트(모바일 가독성/입력 이득)
  const autocompleteHints: Partial<Record<TextFilterKeys, string>> = {
    q: 'off',
    cohort: 'off',
    major: 'off',
    company: 'organization',
    industry: 'off',
    region: 'address-level1',
    jobTitle: 'organization-title',
  };
  return (
    <Accordion summary="필터/정렬" defaultOpen density="sm" className="mb-2">
      <fieldset className="flex flex-wrap items-end gap-3" aria-label="디렉터리 검색 필터">
        {FILTER_FIELDS.map(({ key, label, placeholder, inputMode }) => (
          <label key={key} className="flex flex-col text-xs text-slate-600">
            <span className="mb-1 font-medium text-slate-700">{label}</span>
            <input
              inputMode={inputMode}
              autoComplete={autocompleteHints[key]}
              className="rounded border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              value={value[key]}
              placeholder={placeholder}
              aria-label={label}
              onChange={(event) => onChange(key, event.target.value)}
            />
          </label>
        ))}
        <label className="flex flex-col text-xs text-slate-600">
          <span className="mb-1 font-medium text-slate-700">정렬</span>
          <select
            className="rounded border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            value={value.sort}
            onChange={(event) => onSortChange(event.target.value as SortOption)}
            aria-label="정렬 옵션"
          >
            {Object.entries(SORT_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" onClick={onReset} variant="secondary" size="sm">
          필터 초기화
        </Button>
      </fieldset>
    </Accordion>
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
  sortLabel,
  loadMoreLabel,
}: {
  items: MemberListPage;
  onLoadMore: () => void;
  hasNext: boolean;
  isLoadingMore: boolean;
  sentinelRef: React.MutableRefObject<HTMLDivElement | null>;
  sortLabel: string;
  loadMoreLabel: string;
}) {
  if (items.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-4">
      {/* 카드 뷰 — 모바일 전용 */}
      <ul className="grid gap-3 md:hidden" aria-label={`동문 목록 — ${sortLabel}`}>
        {items.map((m) => (
          <li key={m.id}>
            <DirectoryCard member={m} />
          </li>
        ))}
      </ul>

      {/* 테이블 뷰 — md 이상 유지 */}
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-[640px] table-fixed border-collapse text-left text-sm">
          <caption className="sr-only">동문 목록 — {sortLabel}</caption>
          <thead>
            <tr className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <th className="p-2" scope="col">이름</th>
              <th className="p-2" scope="col">이메일</th>
              <th className="p-2" scope="col">기수</th>
              <th className="p-2" scope="col">전공</th>
              <th className="p-2" scope="col">회사</th>
              <th className="p-2" scope="col">업종</th>
              <th className="p-2" scope="col">공개 범위</th>
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

      {/* 페이지네이션/무한 스크롤 버튼 — 위치/접근성 정리 */}
      <nav
        aria-label="목록 페이지네이션"
        className="flex flex-col items-center gap-2"
        ref={sentinelRef}
      >
        {hasNext ? (
          <Button type="button" onClick={onLoadMore} disabled={isLoadingMore} variant="secondary" size="md">
            {isLoadingMore ? '불러오는 중…' : loadMoreLabel}
          </Button>
        ) : (
          <span className="text-xs text-slate-500">더 이상 결과가 없습니다.</span>
        )}
      </nav>
    </div>
  );
}

function DirectoryPageInner() {
  const {
    filters,
    debouncedFilters,
    updateFilter,
    updateSort,
    resetFilters,
    setPage,
    sharePath,
    copied,
    copyShareLink,
  } = useDirectoryUrlSync();

  const {
    membersQuery,
    visibleItems,
    totalLabel,
    displayedCount,
    currentPage,
    totalPages,
    loadMoreLabel,
    sortOption,
  } = useDirectoryQueries(debouncedFilters);

  const { handleLoadMore, sentinelRef } = useInfiniteLoader(
    membersQuery,
    debouncedFilters.page,
    setPage
  );

  const isLoadingMembers = membersQuery.isPending;
  const membersError = membersQuery.isError;
  const isLoadingMore = membersQuery.isFetchingNextPage;
  const hasNextPage = Boolean(membersQuery.hasNextPage);

  const [shareOpen, setShareOpen] = useState(false);

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
        onSortChange={updateSort}
      />

      <section className="space-y-3" aria-live="polite">
        <div className="flex flex-col gap-2 text-sm text-slate-600">
          <p>
            총 {totalLabel}명 중 {displayedCount.toLocaleString()}명 표시 (페이지 {currentPage}
            {totalPages ? ` / ${totalPages}` : ''})
          </p>
          <div className="flex flex-col gap-2 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-600">공유</span>
              <Button type="button" variant="ghost" size="sm" aria-expanded={shareOpen} aria-controls="share-panel" onClick={() => setShareOpen((v) => !v)}>
                {shareOpen ? '옵션 닫기' : '링크 표시'}
              </Button>
            </div>
            <div id="share-panel" role="region" aria-label="공유 옵션" hidden={!shareOpen}>
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded bg-slate-100 px-2 py-1">{sharePath}</code>
                <Button type="button" variant="secondary" size="sm" onClick={copyShareLink} aria-live="polite">
                  {copied ? '복사 완료' : '복사'}
                </Button>
              </div>
            </div>
          </div>
        </div>
        {isLoadingMembers ? (
          <LoadingMessage>목록을 불러오는 중입니다…</LoadingMessage>
        ) : membersError ? (
          <ErrorMessage message="목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요." />
        ) : (
          <DirectoryResults
            items={visibleItems}
            onLoadMore={handleLoadMore}
            hasNext={hasNextPage}
            isLoadingMore={isLoadingMore}
            sentinelRef={sentinelRef}
            sortLabel={SORT_LABELS[sortOption]}
            loadMoreLabel={loadMoreLabel}
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
