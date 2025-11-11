"use client";

import Image from 'next/image';
import Link from 'next/link';
import React, { useState } from 'react';
import Drawer from './ui/drawer';
import { DrawerMenu } from './drawer-menu';
import { useAuth } from '../hooks/useAuth';

export default function FigmaHeader() {
  const [open, setOpen] = useState(false);
  const { status } = useAuth();
  return (
    <header className="border-b border-neutral-border bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2 text-brand-primary" aria-label="홈으로">
          <Image src="/images/brand/sogang.svg" alt="" width={22} height={32} className="h-auto w-[20px]" priority />
          <Image src="/images/brand/sogang_korean_logo.svg" alt="서강대학교" width={104} height={22} className="h-auto w-[96px]" priority />
          <span className="font-kopub text-base font-bold tracking-tight text-neutral-ink md:text-lg truncate">
            경제대학원 총동문회
          </span>
        </Link>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md border border-neutral-border px-3 py-2 text-sm text-neutral-ink transition hover:bg-brand-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
          aria-controls="primary-navigation"
          aria-expanded={open}
          aria-label={open ? '전체 메뉴 닫기' : '전체 메뉴 열기'}
          onClick={() => setOpen((v) => !v)}
        >
          <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>
      <Drawer open={open} onClose={() => setOpen(false)} title="메뉴" side="right">
        {/* 메뉴는 단일 출처로 유지(dup 제거) */}
        <DrawerMenu status={status} onClose={() => setOpen(false)} />
      </Drawer>
    </header>
  );
}
