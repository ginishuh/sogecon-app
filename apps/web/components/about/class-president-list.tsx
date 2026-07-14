'use client';

import { MagnifyingGlass } from '@phosphor-icons/react';
import React, { useMemo, useState } from 'react';

import type { ClassPresident } from '../../lib/class-presidents';

type ClassPresidentListProps = {
  presidents: readonly ClassPresident[];
};

const COHORT_RANGES = [
  { value: 'all', label: '전체 기수' },
  { value: '1-20', label: '1–20기' },
  { value: '21-40', label: '21–40기' },
  { value: '41-60', label: '41–60기' },
  { value: '61-71', label: '61–71기' }
] as const;

const RANGE_BOUNDS: Record<string, readonly [number, number]> = {
  '1-20': [1, 20],
  '21-40': [21, 40],
  '41-60': [41, 60],
  '61-71': [61, 71]
};

function isInRange(cohort: number, range: string) {
  if (range === 'all') return true;
  const bounds = RANGE_BOUNDS[range];
  if (!bounds) return true;
  const [start, end] = bounds;
  return cohort >= start && cohort <= end;
}

export function ClassPresidentList({ presidents }: ClassPresidentListProps) {
  const [query, setQuery] = useState('');
  const [range, setRange] = useState('all');

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('ko-KR');
    return presidents.filter((president) => {
      if (!isInRange(president.cohort, range)) return false;
      if (!normalizedQuery) return true;
      return [
        `${president.cohort}기`,
        String(president.cohort),
        president.name ?? '',
        president.workplace ?? ''
      ].some((value) => value.toLocaleLowerCase('ko-KR').includes(normalizedQuery));
    });
  }, [presidents, query, range]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 rounded-2xl border border-neutral-border bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_12rem] md:p-5">
        <label className="relative block">
          <span className="sr-only">기수, 이름 또는 근무처 검색</span>
          <MagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="기수, 이름 또는 근무처 검색"
            className="min-h-12 w-full rounded-xl border border-neutral-border bg-white pl-11 pr-4 text-base text-text-primary outline-hidden transition-colors placeholder:text-text-muted focus-visible:border-brand-400 focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_#f17888]"
          />
        </label>
        <label>
          <span className="sr-only">기수 구간</span>
          <select
            value={range}
            onChange={(event) => setRange(event.target.value)}
            className="min-h-12 w-full rounded-xl border border-neutral-border bg-white px-4 text-base text-text-primary outline-hidden transition-colors focus-visible:border-brand-400 focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_#f17888]"
          >
            {COHORT_RANGES.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-neutral-border pb-3">
        <p className="font-heading text-lg font-semibold text-text-primary" aria-live="polite">
          {filtered.length}개 기수
        </p>
        <p className="text-sm text-text-muted">1기부터 71기까지</p>
      </div>

      {filtered.length > 0 ? (
        <ol className="grid gap-x-8 md:grid-cols-2" aria-label="역대 기수별 원우회장">
          {filtered.map((president) => (
            <li key={president.cohort} className="grid min-h-24 grid-cols-[4.25rem_minmax(0,1fr)] items-center gap-4 border-b border-neutral-border py-4 max-[240px]:grid-cols-1 max-[240px]:gap-2">
              <span className="flex size-16 items-center justify-center rounded-full bg-brand-50 font-heading text-lg font-bold text-brand-800 max-[240px]:size-12 max-[240px]:text-base">
                {president.cohort}기
              </span>
              <div className="min-w-0">
                <p className={`font-heading text-lg font-semibold ${president.name ? 'text-text-primary' : 'text-text-muted'}`}>
                  {president.name ?? '공식 명단 미기재'}
                </p>
                <p className="mt-1 break-words text-sm leading-6 text-text-secondary [overflow-wrap:anywhere]">
                  {president.workplace ?? (president.name ? '근무처 미기재' : '확인되는 대로 반영하겠습니다.')}
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="rounded-2xl bg-surface-sunken px-6 py-12 text-center">
          <p className="font-heading text-lg font-semibold text-text-primary">조건에 맞는 원우회장을 찾지 못했어요.</p>
          <button
            type="button"
            onClick={() => { setQuery(''); setRange('all'); }}
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full border border-neutral-border bg-white px-5 font-semibold text-text-secondary outline-hidden focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2"
          >
            전체 명단 보기
          </button>
        </div>
      )}
    </div>
  );
}
