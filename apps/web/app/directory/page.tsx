"use client";

import { MagnifyingGlass, SlidersHorizontal, X } from '@phosphor-icons/react';
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
import MemberDetailModal from '../../components/member-detail-modal';
import Button from '../../components/ui/button';
import type { Member } from '../../services/members';
import { VISIBILITY_INFO } from '../../lib/member-experience';

type DirectoryFiltersProps = {
  value: FilterState;
  onChange: (key: TextFilterKeys, next: string) => void;
  onReset: () => void;
  onSortChange: (next: SortOption) => void;
};

function DirectoryFilters({ value, onChange, onReset, onSortChange }: DirectoryFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // autocomplete 힌트(모바일 가독성/입력 이득)
  const autocompleteHints: Partial<Record<TextFilterKeys, string>> = {
    q: 'off',
    cohort: 'off',
    major: 'off',
    company: 'organization',
    industry: 'off',
    region: 'address-level1',
    jobTitle: 'organization-title',
  };

  const searchField = FILTER_FIELDS.find((field) => field.key === 'q');
  const cohortField = FILTER_FIELDS.find((field) => field.key === 'cohort');
  // 상세 필터: 나머지
  const advancedFields = FILTER_FIELDS.filter((f) => f.key !== 'q' && f.key !== 'cohort');

  return (
    <div className="rounded-2xl border border-neutral-border bg-white p-4 sm:p-5">
      <fieldset className="grid grid-cols-2 items-end gap-3 lg:grid-cols-[minmax(0,1fr)_9rem_11rem_auto]" aria-label="기본 검색 필터">
        {searchField ? (
          <label className="col-span-2 min-w-0 text-xs text-text-muted lg:col-span-1">
            <span className="mb-1.5 block font-semibold text-text-secondary">동문 검색</span>
            <span className="relative block">
              <MagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
              <input
                inputMode={searchField.inputMode}
                autoComplete={autocompleteHints.q}
                className="min-h-12 w-full rounded-xl border border-neutral-border py-2 pl-12 pr-4 text-base focus:border-brand-500 focus:outline-hidden focus:ring-2 focus:ring-brand-400"
                value={value.q}
                placeholder="이름·이메일·회사로 검색"
                aria-label="검색어"
                onChange={(event) => onChange('q', event.target.value)}
              />
            </span>
          </label>
        ) : null}
        {cohortField ? (
          <label className="text-xs text-text-muted">
            <span className="mb-1.5 block font-semibold text-text-secondary">기수</span>
            <input
              inputMode={cohortField.inputMode}
              autoComplete={autocompleteHints.cohort}
              className="min-h-12 w-full rounded-xl border border-neutral-border px-3 py-2 text-sm focus:border-brand-500 focus:outline-hidden focus:ring-2 focus:ring-brand-400"
              value={value.cohort}
              placeholder="예: 10"
              aria-label="기수"
              onChange={(event) => onChange('cohort', event.target.value)}
            />
          </label>
        ) : null}
        <label className="text-xs text-text-muted">
          <span className="mb-1.5 block font-semibold text-text-secondary">정렬</span>
          <select
            className="min-h-12 w-full rounded-xl border border-neutral-border px-3 py-2 text-sm focus:border-brand-500 focus:outline-hidden focus:ring-2 focus:ring-brand-400"
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

        <Button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          variant="secondary"
          size="md"
          className="col-span-2 min-h-12 gap-2 sm:col-span-1 lg:col-span-1"
          aria-expanded={showAdvanced}
          aria-controls="directory-advanced-filters"
        >
          <SlidersHorizontal aria-hidden="true" size={18} />
          {showAdvanced ? '상세 검색 닫기' : '상세 검색'}
        </Button>
      </fieldset>

      <fieldset
        id="directory-advanced-filters"
        className={`${showAdvanced ? 'mt-5 grid' : 'hidden'} grid-cols-2 gap-3 border-t border-neutral-border pt-5 lg:grid-cols-6`}
        aria-label="상세 검색 필터"
      >
        {advancedFields.map(({ key, label, placeholder, inputMode }) => (
          <label key={key} className="min-w-0 text-xs text-text-muted">
            <span className="mb-1.5 block font-semibold text-text-secondary">{label}</span>
            <input
              inputMode={inputMode}
              autoComplete={autocompleteHints[key]}
              className="min-h-11 w-full rounded-xl border border-neutral-border px-3 py-2 text-sm focus:border-brand-500 focus:outline-hidden focus:ring-2 focus:ring-brand-400"
              value={value[key]}
              placeholder={placeholder}
              aria-label={label}
              onChange={(event) => onChange(key, event.target.value)}
            />
          </label>
        ))}
        <Button type="button" onClick={onReset} variant="ghost" size="md" className="col-span-2 gap-2 self-end lg:col-span-1">
          <X aria-hidden="true" size={17} />
          필터 초기화
        </Button>
      </fieldset>
    </div>
  );
}

function LoadingMessage({ children }: { children: ReactNode }) {
  return (
    <div role="status" aria-live="polite" className="rounded border border-neutral-border bg-surface-raised px-3 py-2 text-sm text-text-muted">
      {children}
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded border border-state-error-ring bg-state-error-subtle px-3 py-2 text-sm text-state-error">
      {message}
    </div>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3 rounded-xl border border-neutral-border bg-surface-raised px-4 py-8 text-center text-sm text-text-muted">
      <p className="font-semibold text-text-primary">조건에 맞는 동문을 찾지 못했어요.</p>
      <p>검색어를 줄이거나 필터를 초기화해 다시 찾아보세요.</p>
      <Button type="button" variant="secondary" onClick={onReset}>모든 필터 초기화</Button>
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
  onMemberClick,
  onReset,
}: {
  items: MemberListPage;
  onLoadMore: () => void;
  hasNext: boolean;
  isLoadingMore: boolean;
  sentinelRef: React.MutableRefObject<HTMLDivElement | null>;
  sortLabel: string;
  loadMoreLabel: string;
  onMemberClick: (member: Member) => void;
  onReset: () => void;
}) {
  if (items.length === 0) {
    return <EmptyState onReset={onReset} />;
  }

  return (
    <div className="space-y-4">
      <ul className="grid gap-3 lg:hidden" aria-label={`동문 목록 — ${sortLabel}`}>
        {items.map((m) => (
          <li key={m.id}>
            <DirectoryCard member={m} onClick={() => onMemberClick(m)} />
          </li>
        ))}
      </ul>

      <ul className="hidden divide-y divide-neutral-border border-y border-neutral-border lg:block" aria-label={`동문 목록 — ${sortLabel}`}>
        {items.map((member) => {
          const workSummary = [member.company, member.job_title].filter(Boolean).join(' · ');
          return (
            <li key={member.id} className="grid min-h-28 grid-cols-[4rem_minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-5 px-3 py-5 transition-colors hover:bg-surface-raised">
              <div className="flex size-16 items-center justify-center rounded-full bg-neutral-subtle text-2xl font-medium text-text-muted" aria-hidden="true">
                {member.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-text-primary">{member.name}</p>
                <p className="mt-1 text-sm font-medium text-brand-700">{member.cohort}기</p>
                {member.email ? <p className="mt-1 truncate text-sm text-text-muted">{member.email}</p> : null}
              </div>
              <div className="min-w-0 text-sm">
                <p className="font-medium text-text-secondary">소속 · 직함</p>
                <p className="mt-1 truncate text-text-muted">{workSummary || '소속 정보 비공개'}</p>
              </div>
              <p className="text-sm text-text-muted">{VISIBILITY_INFO[member.visibility].label}</p>
              <Button type="button" variant="secondary" size="md" onClick={() => onMemberClick(member)} aria-label={`${member.name} 상세 정보 보기`}>
                프로필 보기
              </Button>
            </li>
          );
        })}
      </ul>

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
          <span className="text-xs text-text-muted">더 이상 결과가 없습니다.</span>
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
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const activeFilterCount = [filters.q, filters.cohort, filters.major, filters.company, filters.industry, filters.region, filters.jobTitle].filter((value) => value.trim()).length;
  const hasNonDefaultState = activeFilterCount > 0 || filters.sort !== 'recent' || filters.page > 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="space-y-2">
        <h1 className="text-[1.75rem] font-semibold tracking-[-0.035em] text-text-primary md:text-[2rem]">동문 수첩</h1>
        <p className="text-sm leading-6 text-text-muted sm:text-base">
          이름과 소속으로 동문을 찾아보세요. 각 동문이 공개하기로 한 정보만 표시됩니다.
        </p>
      </header>

      <DirectoryFilters
        value={filters}
        onChange={updateFilter}
        onReset={resetFilters}
        onSortChange={updateSort}
      />

      <section className="space-y-4" aria-live="polite" aria-labelledby="directory-results-title">
        <div className="flex flex-col gap-3 border-b border-neutral-border pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap items-end gap-2 sm:gap-3">
            <div>
              <h2 id="directory-results-title" className="text-xl font-semibold text-text-primary">{displayedCount.toLocaleString()}명의 동문</h2>
              <p className="mt-1 text-sm text-text-muted">
                {activeFilterCount > 0 ? `검색 조건 ${activeFilterCount}개 · ` : ''}전체 {totalLabel}명
                <span className="sr-only"> (페이지 {currentPage}{totalPages ? ` / ${totalPages}` : ''})</span>
              </p>
            </div>
            {hasNonDefaultState ? (
              <Button type="button" variant="ghost" size="sm" className="gap-1.5" aria-label="검색 조건과 정렬 초기화" onClick={resetFilters}>
                <X aria-hidden="true" size={16} />
                필터 초기화
              </Button>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 text-xs text-text-muted sm:items-end">
            <div className="flex items-center gap-2">
              <span className="font-medium text-text-secondary">공유</span>
              <Button type="button" variant="ghost" size="sm" aria-expanded={shareOpen} aria-controls="share-panel" onClick={() => setShareOpen((v) => !v)}>
                {shareOpen ? '옵션 닫기' : '링크 표시'}
              </Button>
            </div>
            <div id="share-panel" role="region" aria-label="공유 옵션" hidden={!shareOpen}>
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded bg-surface-raised px-2 py-1">{sharePath}</code>
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
          <div className="space-y-2"><ErrorMessage message="동문 목록을 불러오지 못했습니다." /><Button variant="secondary" onClick={() => void membersQuery.refetch()}>다시 불러오기</Button></div>
        ) : (
          <DirectoryResults
            items={visibleItems}
            onLoadMore={handleLoadMore}
            hasNext={hasNextPage}
            isLoadingMore={isLoadingMore}
            sentinelRef={sentinelRef}
            sortLabel={SORT_LABELS[sortOption]}
            loadMoreLabel={loadMoreLabel}
            onMemberClick={setSelectedMember}
            onReset={resetFilters}
          />
        )}
      </section>

      {/* 회원 상세 모달 */}
      <MemberDetailModal
        member={selectedMember}
        open={selectedMember !== null}
        onClose={() => setSelectedMember(null)}
      />
    </div>
  );
}

export default function DirectoryPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-text-muted">로딩 중…</div>}>
      <DirectoryPageInner />
    </Suspense>
  );
}
