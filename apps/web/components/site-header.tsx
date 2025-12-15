"use client";

import Image from 'next/image';
import Link from 'next/link';
import React, { useState } from 'react';
import Drawer from './ui/drawer';
import { useAuth } from '../hooks/useAuth';
import { LazyDrawerMenu } from './lazy';
import { logoutAll } from '../services/auth';
import { HeaderDropdown } from './header-dropdown';

const ABOUT_ITEMS = [
  { href: '/about/greeting', label: '인사말' },
  { href: '/about/org', label: '조직도' },
  { href: '/about/history', label: '연혁' },
  { href: '/posts?category=notice', label: '공지사항' },
] as const;

const ADMIN_ITEMS = [
  { href: '/admin/posts', label: '게시물 관리' },
  { href: '/admin/events', label: '행사 관리' },
  { href: '/admin/hero', label: '홈 배너 관리' },
  { href: '/admin/notifications', label: '알림 관리' },
  { href: '/posts/new', label: '새 글 작성' },
  { href: '/events/new', label: '새 행사 생성' },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
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
          <HeaderDropdown label="총동문회 소개" items={ABOUT_ITEMS} />
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
          {isAdmin && <HeaderDropdown label="관리자" items={ADMIN_ITEMS} variant="admin" align="right" />}
        </nav>

        {/* 데스크톱 우측 버튼들 */}
        <DesktopAuthButtons status={status} name={data?.name} />

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
        <LazyDrawerMenu status={status} onClose={() => setOpen(false)} />
      </Drawer>
    </header>
  );
}

/** 데스크톱 우측 인증 버튼 영역 */
function DesktopAuthButtons({ status, name }: { status: string; name?: string }) {
  if (status === 'authorized') {
    return (
      <div className="hidden lg:flex items-center gap-2">
        <Link
          href="/me"
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-neutral-ink no-underline hover:no-underline hover:text-[#b60007] transition-colors"
        >
          <svg className="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 14a6 6 0 0 1 12 0" strokeLinecap="round" />
          </svg>
          {name || '내 정보'}
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
      </div>
    );
  }

  return (
    <div className="hidden lg:flex items-center gap-2">
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
    </div>
  );
}
