"use client";

import Image from 'next/image';
import Link from 'next/link';
import React, { useState } from 'react';
import Drawer from './ui/drawer';
import { HeaderAuth } from './header-auth';
import { useAuth } from '../hooks/useAuth';

export default function FigmaHeader() {
  const [open, setOpen] = useState(false);
  const { status } = useAuth();
  return (
    <header className="border-b border-neutral-border bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2 text-brand-primary" aria-label="홈으로">
          <Image src="/images/brand/seogang.svg" alt="" width={22} height={32} className="h-auto w-[20px]" priority />
          <Image src="/images/brand/seogang_korean_logo.svg" alt="서강대학교" width={104} height={22} className="h-auto w-[96px]" priority />
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
        <nav id="primary-navigation" aria-label="전체 메뉴" className="flex h-full flex-col gap-3 overflow-y-auto p-4 text-sm text-neutral-muted font-menu">
          {/* 세션 상태: 비로그인 시 상단에 로그인 버튼 노출 */}
          {status === 'unauthorized' ? (
            <div className="mb-2">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="block rounded-md bg-slate-900 px-3 py-2 text-center text-sm text-white hover:bg-slate-800"
              >
                로그인
              </Link>
            </div>
          ) : (
            <div className="mb-2">
              <HeaderAuth />
            </div>
          )}
          <ul className="grid gap-2" aria-label="주요">
            <li><Link className="block rounded-md border border-neutral-border px-3 py-2 hover:border-brand-primary hover:text-brand-primary" href="/about/greeting" onClick={() => setOpen(false)}>총동문회 소개</Link></li>
            <li><Link className="block rounded-md border border-neutral-border px-3 py-2 hover:border-brand-primary hover:text-brand-primary" href="/directory" onClick={() => setOpen(false)}>동문 수첩</Link></li>
            <li><Link className="block rounded-md border border-neutral-border px-3 py-2 hover:border-brand-primary hover:text-brand-primary" href="/events" onClick={() => setOpen(false)}>행사</Link></li>
            <li><Link className="block rounded-md border border-neutral-border px-3 py-2 hover:border-brand-primary hover:text-brand-primary" href="/posts" onClick={() => setOpen(false)}>소식</Link></li>
            <li><Link className="block rounded-md border border-neutral-border px-3 py-2 hover:border-brand-primary hover:text-brand-primary" href={{ pathname: '/board', query: { tab: 'discussion' } }} onClick={() => setOpen(false)}>자유게시판</Link></li>
            <li><Link className="block rounded-md border border-neutral-border px-3 py-2 hover:border-brand-primary hover:text-brand-primary" href={{ pathname: '/board', query: { tab: 'congrats' } }} onClick={() => setOpen(false)}>경조사 게시판</Link></li>
          </ul>
        </nav>
      </Drawer>
    </header>
  );
}
