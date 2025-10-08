"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';

import { HeaderAuth } from './header-auth';
import { NotifyCTA } from './notify-cta';
import { RequireMember } from './require-member';
import { RequireAdmin } from './require-admin';

type LinkItem = {
  href: Route;
  label: string;
};

const PRIMARY_LINKS: LinkItem[] = [
  { href: '/', label: '홈' },
  { href: '/posts', label: '총원우회 소식' },
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
  const [open, setOpen] = useState(false);

  const closeMenu = () => setOpen(false);

  return (
    <header className="border-b border-neutral-border bg-white shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-brand-primary">
          <span
            aria-label="총원우회 홈으로 이동"
            className="rounded-full bg-brand-primary px-2 py-1 text-sm text-white"
          >
            SG
          </span>
          <span className="tracking-tight text-neutral-ink">서강대 경제대학원 총원우회</span>
        </Link>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md border border-neutral-border px-3 py-2 text-sm text-neutral-ink transition hover:bg-brand-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent md:hidden"
          aria-controls="primary-navigation"
          aria-expanded={open}
          aria-label={open ? '전체 메뉴 닫기' : '전체 메뉴 열기'}
          onClick={() => setOpen((prev) => !prev)}
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
        <div className="hidden flex-1 items-center justify-between md:flex">
          <nav
            aria-label="주 메뉴"
            className="flex flex-1 items-center justify-between gap-10 text-sm text-neutral-muted"
          >
            <ul className="flex items-center gap-5">
              {PRIMARY_LINKS.map((link) => (
                <li key={link.href}>
                  <Link className="transition hover:text-brand-primary" href={link.href}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex items-start gap-8 text-xs">
              <div aria-label="총원우회 소개" className="flex flex-col gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-muted">
                  총원우회 소개
                </span>
                <ul className="flex flex-col gap-2">
                  {ABOUT_LINKS.map((link) => (
                    <li key={link.href}>
                      <Link className="transition hover:text-brand-primary" href={link.href}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div aria-label="고객 지원" className="flex flex-col gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-muted">
                  고객 지원
                </span>
                <ul className="flex flex-col gap-2">
                  {SUPPORT_LINKS.map((link) => (
                    <li key={link.href}>
                      <Link className="transition hover:text-brand-primary" href={link.href}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <RequireAdmin>
                <div aria-label="관리자 메뉴" className="flex flex-col gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-muted">
                    관리자
                  </span>
                  <ul className="flex flex-col gap-2">
                    {ADMIN_LINKS.map((link) => (
                      <li key={link.href}>
                        <Link className="transition hover:text-brand-primary" href={link.href}>
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </RequireAdmin>
            </div>
          </nav>
          <div className="flex items-center gap-4">
            <RequireMember>
              <NotifyCTA />
            </RequireMember>
            <HeaderAuth />
          </div>
        </div>
      </div>
      <div
        id="primary-navigation"
        className={`md:hidden ${open ? 'block' : 'hidden'} border-t border-neutral-border bg-white px-4 pb-4`}
      >
        <nav aria-label="모바일 주 메뉴" className="flex flex-col gap-4 pt-4 text-sm text-neutral-muted">
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
          <section aria-label="총원우회 소개 링크" className="space-y-2">
            <h2 className="text-xs font-semibold uppercase text-neutral-muted">총원우회 소개</h2>
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
          <RequireAdmin
            fallback={
              <div className="text-xs text-neutral-muted">
                관리자 전용 메뉴는 로그인 후 확인할 수 있습니다.
              </div>
            }
          >
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
          <div className="flex flex-col gap-2 border-t border-neutral-border pt-4">
            <RequireMember>
              <NotifyCTA />
            </RequireMember>
            <HeaderAuth />
          </div>
        </nav>
      </div>
    </header>
  );
}
