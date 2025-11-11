"use client";

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';

import { HeaderAuth } from './header-auth';
import { NotifyCTA } from './notify-cta';
import { RequireAdmin } from './require-admin';
import { useAuth } from '../hooks/useAuth';
import Drawer from './ui/drawer';
import { NavDropdown } from './ui/nav-dropdown';
import { DrawerMenu } from './drawer-menu';

type LinkItem = {
  href: Route;
  label: string;
};

const PRIMARY_LINKS: LinkItem[] = [
  { href: '/', label: '홈' },
  { href: '/posts', label: '총동문회 소식' },
  { href: '/events', label: '행사' }
];

const ABOUT_LINKS: LinkItem[] = [
  { href: '/about/greeting', label: '인사말' },
  { href: '/about/org', label: '조직도' },
  { href: '/about/history', label: '연혁' }
];

const SUPPORT_LINKS: LinkItem[] = [
  { href: '/faq', label: '자주 묻는 질문' },
  { href: '/terms', label: '이용약관' },
  { href: '/privacy', label: '개인정보처리방침' }
];

const ADMIN_LINKS: LinkItem[] = [
  { href: '/admin/notifications', label: '알림(Admin)' },
  { href: '/posts/new', label: '게시글 작성' },
  { href: '/events/new', label: '행사 생성' }
];

export function SiteHeader() {
  const { status } = useAuth();
  const [open, setOpen] = useState(false);
  const toggleBtnRef = useRef<HTMLButtonElement | null>(null);

  const closeMenu = () => setOpen(false);

  return (
    <header className="border-b border-neutral-border bg-white shadow-sm">
      <div className="mx-auto max-w-6xl flex flex-row items-center justify-between gap-4 px-4 py-4 md:grid md:grid-cols-4 md:items-start md:justify-normal md:px-6">
        <Link href="/" className="flex items-center gap-2 md:gap-3 text-brand-primary md:col-span-2 min-w-0" aria-label="총동문회 홈으로 이동">
          {/* 서강대 심볼 로고 */}
          <Image
            src="/images/brand/sogang.svg"
            alt=""
            width={24}
            height={34}
            className="h-auto w-[20px] md:w-[24px] shrink-0"
            priority
          />
          <span className="font-kopub font-bold tracking-tight text-neutral-ink text-base md:text-lg whitespace-nowrap">
            서강대학교 경제대학원 총동문회
          </span>
        </Link>
        <button
          type="button"
          className="site-header__hamburger inline-flex items-center justify-center rounded-full size-10 text-neutral-ink transition hover:bg-neutral-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={open ? '전체 메뉴 닫기' : '전체 메뉴 열기'}
          onClick={() => setOpen((prev) => !prev)}
          ref={toggleBtnRef}
        >
          <span className="sr-only">메뉴 토글</span>
          <svg aria-hidden="true" className="size-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
        {/* col-2: 주요 링크 */}
        <div className="site-header__desktop-nav hidden md:block">
          <nav aria-label="주 메뉴" className="text-sm text-neutral-muted font-menu">
            <ul className="flex items-center gap-5">
              {PRIMARY_LINKS.map((link) => (
                <li key={link.href}>
                  <Link className="transition hover:text-brand-primary" href={link.href}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        {/* col-3: 드롭다운(롤아웃) */}
        <div className="site-header__desktop-menus hidden items-center gap-6 md:flex font-menu">
          <NavDropdown label="총동문회 소개" items={ABOUT_LINKS} />
          <NavDropdown label="고객 지원" items={SUPPORT_LINKS} />
          <RequireAdmin fallback={null}>
            <div className="hidden 2xl:block">
              <NavDropdown label="관리자" items={ADMIN_LINKS} />
            </div>
          </RequireAdmin>
        </div>
        {/* col-4: 세션/로그인 */}
        <div className="site-header__auth hidden items-center justify-end gap-4 md:flex">
          <NotifyCTA />
          {status === 'authorized' ? (
            <HeaderAuth />
          ) : (
            <Link href="/login" className="text-sm text-slate-600 hover:underline">로그인</Link>
          )}
        </div>
      </div>
      {/* Drawer 메뉴 */}
      <Drawer open={open} onClose={closeMenu} side="right" className="w-[285px]">
        <DrawerMenu status={status} onClose={closeMenu} />
      </Drawer>
    </header>
  );
}
