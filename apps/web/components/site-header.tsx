"use client";

import Image from 'next/image';
import Link from 'next/link';
import React, { useState } from 'react';
import Drawer from './ui/drawer';
import { useAuth } from '../hooks/useAuth';
import { LazyDrawerMenu } from './lazy';
import { logoutAll } from '../services/auth';
// import { HeaderNotifyCTA } from './header-notify-cta';

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const { status, data } = useAuth();
  const isAdmin = status === 'authorized' && data?.kind === 'admin';

  return (
    <header className="border-b-2 border-[#b60007] bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
        {/* 로고 */}
        <Link href="/" className="flex min-w-0 items-center gap-2 text-brand-primary no-underline hover:no-underline" aria-label="홈으로">
          <Image src="/images/brand/sogang-signature.png" alt="서강대학교" width={150} height={50} className="h-auto w-[100px] lg:w-[150px]" priority />
          <span className="font-kopub text-lg tracking-tight text-neutral-ink lg:text-xl truncate">
            경제대학원 총동문회
          </span>
        </Link>

        {/* 데스크톱 네비게이션 */}
        <nav className="hidden lg:flex items-center gap-2" aria-label="주요 메뉴">
          {/* 총동문회 소개 드롭다운 */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setAboutOpen(!aboutOpen)}
              onBlur={() => setTimeout(() => setAboutOpen(false), 150)}
              className="flex items-center gap-1 px-3 py-2 font-kopub text-base text-neutral-ink hover:text-[#b60007] transition-colors"
            >
              총동문회 소개
              <svg className={`size-4 transition-transform ${aboutOpen ? 'rotate-180' : ''}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {aboutOpen && (
              <div className="absolute top-full left-0 mt-1 w-36 bg-white border border-neutral-border rounded-lg shadow-lg py-1 z-50">
                <Link href="/about/greeting" className="block px-4 py-2 font-kopub text-sm text-neutral-ink no-underline hover:no-underline hover:bg-neutral-surface hover:text-[#b60007]">인사말</Link>
                <Link href="/about/org" className="block px-4 py-2 font-kopub text-sm text-neutral-ink no-underline hover:no-underline hover:bg-neutral-surface hover:text-[#b60007]">조직도</Link>
                <Link href="/about/history" className="block px-4 py-2 font-kopub text-sm text-neutral-ink no-underline hover:no-underline hover:bg-neutral-surface hover:text-[#b60007]">연혁</Link>
                <Link href="/posts?category=notice" className="block px-4 py-2 font-kopub text-sm text-neutral-ink no-underline hover:no-underline hover:bg-neutral-surface hover:text-[#b60007]">공지사항</Link>
              </div>
            )}
          </div>

          <Link href="/posts" className="px-3 py-2 font-kopub text-base text-neutral-ink no-underline hover:no-underline hover:text-[#b60007] transition-colors">
            소식
          </Link>
          <Link href="/board" className="px-3 py-2 font-kopub text-base text-neutral-ink no-underline hover:no-underline hover:text-[#b60007] transition-colors">
            게시판
          </Link>
          <Link href="/events" className="px-3 py-2 font-kopub text-base text-neutral-ink no-underline hover:no-underline hover:text-[#b60007] transition-colors">
            행사 일정
          </Link>
          <Link href="/directory" className="px-3 py-2 font-kopub text-base text-neutral-ink no-underline hover:no-underline hover:text-[#b60007] transition-colors">
            동문 수첩
          </Link>

          {/* 관리자 메뉴 드롭다운 */}
          {isAdmin && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setAdminOpen(!adminOpen)}
                onBlur={() => setTimeout(() => setAdminOpen(false), 150)}
                className="flex items-center gap-1 px-3 py-2 font-kopub text-base text-[#b60007] hover:text-[#8a0005] transition-colors"
              >
                관리자
                <svg className={`size-4 transition-transform ${adminOpen ? 'rotate-180' : ''}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {adminOpen && (
                <div className="absolute top-full right-0 mt-1 w-36 bg-white border border-neutral-border rounded-lg shadow-lg py-1 z-50">
                  <Link href="/admin/notifications" className="block px-4 py-2 font-kopub text-sm text-neutral-ink no-underline hover:no-underline hover:bg-neutral-surface hover:text-[#b60007]">알림 관리</Link>
                  <Link href="/posts/new" className="block px-4 py-2 font-kopub text-sm text-neutral-ink no-underline hover:no-underline hover:bg-neutral-surface hover:text-[#b60007]">새 글 작성</Link>
                  <Link href="/events/new" className="block px-4 py-2 font-kopub text-sm text-neutral-ink no-underline hover:no-underline hover:bg-neutral-surface hover:text-[#b60007]">새 행사 생성</Link>
                </div>
              )}
            </div>
          )}
        </nav>

        {/* 데스크톱 우측 버튼들 */}
        <div className="hidden lg:flex items-center gap-2">
          {/* <HeaderNotifyCTA /> */}
          {status === 'authorized' ? (
            <>
              <Link
                href="/me"
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-neutral-ink no-underline hover:no-underline hover:text-[#b60007] transition-colors"
              >
                <svg className="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 14a6 6 0 0 1 12 0" strokeLinecap="round" />
                </svg>
                {data?.name || '내 정보'}
              </Link>
              <button
                type="button"
                onClick={() => {
                  void logoutAll().finally(() => {
                    window.location.href = '/login';
                  });
                }}
                className="px-3 py-2 text-sm text-neutral-muted hover:text-[#b60007] transition-colors"
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="px-3 py-2 text-sm text-white bg-[#b60007] rounded-lg no-underline hover:no-underline hover:text-white visited:text-white hover:bg-[#8a0005] transition-colors"
              >
                로그인
              </Link>
              <Link
                href="/activate"
                className="px-3 py-2 text-sm text-[#b60007] border border-[#b60007] rounded-lg no-underline hover:no-underline hover:bg-[#fff5f5] transition-colors"
              >
                계정 활성화
              </Link>
            </>
          )}
        </div>

        {/* 모바일 햄버거 버튼 */}
        <button
          type="button"
          className="lg:hidden inline-flex items-center justify-center rounded-md border border-[#e8c0c0] px-3 py-2 text-sm transition hover:bg-[#fff5f5] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b60007]"
          aria-controls="primary-navigation"
          aria-expanded={open}
          aria-label={open ? '전체 메뉴 닫기' : '전체 메뉴 열기'}
          onClick={() => setOpen((v) => !v)}
        >
          <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="#b60007" strokeWidth={2} viewBox="0 0 24 24">
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
        <LazyDrawerMenu status={status} onClose={() => setOpen(false)} />
      </Drawer>
    </header>
  );
}
