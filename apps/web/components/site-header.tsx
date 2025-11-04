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

type LinkItem = {
  href: Route;
  label: string;
};

const PRIMARY_LINKS: LinkItem[] = [
  { href: '/', label: '홈' },
  { href: '/posts', label: '총동문회 소식' },
  { href: '/events', label: '행사' }
];

// Drawer 메뉴 섹션
const MENU_LINKS: LinkItem[] = [
  { href: '/', label: '홈' },
  { href: '/board', label: '게시판' },
  { href: '/events', label: '행사 일정' },
  { href: '/directory', label: '동문 수첩' }
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
          {/* 심볼 */}
          <Image
            src="/images/brand/sogang.svg"
            alt=""
            width={24}
            height={34}
            className="h-auto w-[20px] md:w-[24px] shrink-0"
            priority
          />
          {/* 한글 로고 */}
          <Image
            src="/images/brand/sogang_korean_logo.svg"
            alt="서강대학교"
            width={112}
            height={24}
            className="h-auto w-[96px] md:w-[112px] shrink-0"
            priority
          />
          <span className="font-kopub font-bold tracking-tight text-neutral-ink text-base md:text-lg whitespace-nowrap">
            경제대학원 총동문회
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
        <nav id="primary-navigation" aria-label="전체 메뉴" className="flex h-full flex-col gap-6 overflow-y-auto">
          {/* 로그인/계정 활성화 버튼 */}
          {status === 'unauthorized' && (
            <div className="flex gap-2 border-b border-neutral-border pb-4">
              <Link
                href="/login"
                onClick={closeMenu}
                className="flex-1 flex items-center justify-center gap-2 rounded-[10px] bg-brand-primary px-3 py-2.5 text-white text-base hover:bg-[#6c1722] transition-colors"
              >
                <svg className="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 14a6 6 0 0 1 12 0" strokeLinecap="round" />
                </svg>
                로그인
              </Link>
              <Link
                href="/activate"
                onClick={closeMenu}
                className="flex-1 flex items-center justify-center gap-2 rounded-[10px] border border-brand-primary px-3 py-2.5 text-brand-primary text-base hover:bg-brand-primary/5 transition-colors"
              >
                <svg className="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="7" width="10" height="7" rx="1" />
                  <path d="M5 7V5a3 3 0 0 1 6 0v2" strokeLinecap="round" />
                </svg>
                계정 활성화
                
              </Link>
            </div>
          )}

          {/* 메뉴 섹션 */}
          <section aria-label="메뉴" className="space-y-0">
            <h2 className="text-xs font-medium text-neutral-muted px-3 mb-2">메뉴</h2>
            <ul>
              {MENU_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-neutral-ink text-base hover:bg-neutral-surface transition-colors"
                    href={link.href}
                    onClick={closeMenu}
                  >
                    {link.label === '홈' && (
                      <svg className="size-5 text-neutral-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M3 10l7-7 7 7v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-8z" />
                        <path d="M9 17v-6h2v6" />
                      </svg>
                    )}
                    {link.label === '게시판' && (
                      <svg className="size-5 text-neutral-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M3 3h14v11a1 1 0 0 1-1 1H3V3z" />
                        <path d="M6 7h8M6 10h8" />
                      </svg>
                    )}
                    {link.label === '행사 일정' && (
                      <svg className="size-5 text-neutral-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="4" width="14" height="12" rx="1" />
                        <path d="M6 2v4M14 2v4M3 8h14" />
                      </svg>
                    )}
                    {link.label === '동문 수첩' && (
                      <svg className="size-5 text-neutral-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M4 2h10a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
                        <path d="M7 6h6M7 10h4" />
                      </svg>
                    )}
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* 소개 섹션 */}
          <section aria-label="소개" className="space-y-0">
            <h2 className="text-xs font-medium text-neutral-muted px-3 mb-2">소개</h2>
            <ul>
              {ABOUT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-neutral-ink text-base hover:bg-neutral-surface transition-colors"
                    href={link.href}
                    onClick={closeMenu}
                  >
                    <svg className="size-5 text-neutral-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 18a6 6 0 0 1 12 0" />
                    </svg>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* 정보 섹션 */}
          <section aria-label="정보" className="space-y-0 border-t border-neutral-border pt-4">
            <h2 className="text-xs font-medium text-neutral-muted px-3 mb-2">정보</h2>
            <ul>
              {SUPPORT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-neutral-ink text-base hover:bg-neutral-surface transition-colors"
                    href={link.href}
                    onClick={closeMenu}
                  >
                    {link.label === '자주 묻는 질문' && (
                      <svg className="size-5 text-neutral-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="10" cy="10" r="7" />
                        <path d="M10 14v.01M10 11a2 2 0 0 1 2-2" />
                      </svg>
                    )}
                    {link.label === '이용약관' && (
                      <svg className="size-5 text-neutral-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M5 3h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
                        <path d="M7 7h6M7 10h6M7 13h4" />
                      </svg>
                    )}
                    {link.label === '개인정보처리방침' && (
                      <svg className="size-5 text-neutral-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="5" y="8" width="10" height="9" rx="1" />
                        <path d="M7 8V6a3 3 0 0 1 6 0v2" />
                      </svg>
                    )}
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </nav>
      </Drawer>
    </header>
  );
}
