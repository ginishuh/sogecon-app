"use client";

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';

import { HeaderAuth } from './header-auth';
import { NotifyCTA } from './notify-cta';
import { RequireAdmin } from './require-admin';
import { useAuth } from '../hooks/useAuth';
import { LoginInline } from './login-inline';
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

const ABOUT_LINKS: LinkItem[] = [
  { href: '/about/greeting', label: '회장 인사말' },
  { href: '/about/org', label: '조직도' },
  { href: '/about/history', label: '역대 회장단' }
];

const SUPPORT_LINKS: LinkItem[] = [
  { href: '/faq', label: 'FAQ' },
  { href: '/privacy', label: '개인정보 처리방침' },
  { href: '/terms', label: '이용약관' }
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
        <Link href="/" className="flex items-center gap-3 text-brand-primary" aria-label="총동문회 홈으로 이동">
          <Image
            src="/images/brand/seogang_korean_logo.svg"
            alt="서강대학교"
            width={112}
            height={24}
            priority
          />
          <span className="font-kopub font-bold tracking-tight text-neutral-ink text-sm md:text-base">
            경제대학원 총동문회
          </span>
        </Link>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md border border-neutral-border px-3 py-2 text-sm text-neutral-ink transition hover:bg-brand-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent md:hidden"
          aria-controls="primary-navigation"
          aria-expanded={open}
          aria-label={open ? '전체 메뉴 닫기' : '전체 메뉴 열기'}
          onClick={() => setOpen((prev) => !prev)}
          ref={toggleBtnRef}
        >
          <span className="sr-only">메뉴 토글</span>
          <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
        {/* col-2: 주요 링크 */}
        <div className="hidden md:block">
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
        <div className="hidden items-center gap-6 md:flex font-menu">
          <NavDropdown label="총동문회 소개" items={ABOUT_LINKS} />
          <NavDropdown label="고객 지원" items={SUPPORT_LINKS} />
          <RequireAdmin fallback={null}>
            <div className="hidden 2xl:block">
              <NavDropdown label="관리자" items={ADMIN_LINKS} />
            </div>
          </RequireAdmin>
        </div>
        {/* col-4: 세션/로그인 */}
        <div className="hidden items-center justify-end gap-4 md:flex">
          <NotifyCTA />
          {status === 'authorized' ? (
            <HeaderAuth />
          ) : (
            <Link href="/login" className="text-sm text-slate-600 hover:underline">로그인</Link>
          )}
        </div>
      </div>
      {/* 모바일 내비: Drawer 연동 */}
      <Drawer open={open} onClose={closeMenu} title="전체 메뉴" side="right">
        <nav id="primary-navigation" aria-label="모바일 주 메뉴" className="flex h-full flex-col gap-4 overflow-y-auto p-4 text-sm text-neutral-muted font-menu">
          {status === 'unauthorized' && (
            <div className="mb-2">
              <Link
                href="/login"
                onClick={closeMenu}
                className="block rounded-md bg-slate-900 px-3 py-2 text-center text-sm text-white hover:bg-slate-800"
              >
                로그인
              </Link>
            </div>
          )}
          <ul className="grid gap-3" aria-label="주요 링크">
            {PRIMARY_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  className="block rounded-md border border-neutral-border px-3 py-2 hover:border-brand-primary hover:text-brand-primary"
                  href={link.href}
                  onClick={closeMenu}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <section aria-label="총동문회 소개 링크" className="space-y-2">
            <h2 className="text-xs font-semibold uppercase text-neutral-muted">총동문회 소개</h2>
            <ul className="grid gap-2">
              {ABOUT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    className="block rounded-md px-3 py-2 hover:bg-brand-surface hover:text-brand-primary"
                    href={link.href}
                    onClick={closeMenu}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <section aria-label="고객 지원 링크" className="space-y-2">
            <h2 className="text-xs font-semibold uppercase text-neutral-muted">고객 지원</h2>
            <ul className="grid gap-2">
              {SUPPORT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    className="block rounded-md px-3 py-2 hover:bg-brand-surface hover:text-brand-primary"
                    href={link.href}
                    onClick={closeMenu}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <RequireAdmin fallback={null}>
            <section aria-label="관리자 링크" className="space-y-2">
              <h2 className="text-xs font-semibold uppercase text-neutral-muted">관리자</h2>
              <ul className="grid gap-2">
                {ADMIN_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      className="block rounded-md px-3 py-2 hover:bg-brand-surface hover:text-brand-primary"
                      href={link.href}
                      onClick={closeMenu}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </RequireAdmin>
          <div className="mt-auto flex flex-col gap-2 border-t border-neutral-border pt-4">
            <NotifyCTA />
            {status === 'unauthorized' ? (
              <section aria-label="빠른 로그인" className="rounded border border-neutral-border p-3">
                <h3 className="mb-2 text-xs font-semibold text-neutral-muted">빠른 로그인</h3>
                <LoginInline onSuccess={closeMenu} />
              </section>
            ) : (
              <HeaderAuth />
            )}
          </div>
        </nav>
      </Drawer>
    </header>
  );
}
