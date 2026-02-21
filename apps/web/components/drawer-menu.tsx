import React, { useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { RequireAdmin } from './require-admin';
import { NotifyCTA } from './notify-cta';
import { logoutAll } from '../services/auth';
import { useAuth } from '../hooks/useAuth';
import { hasPermissionSession, type AdminPermissionToken } from '../lib/rbac';

type LinkItem = {
  href: Route;
  label: string;
};

const ABOUT_LINKS: LinkItem[] = [
  { href: '/about/greeting', label: '총동문회장 인사말' },
  { href: '/about/dean-greeting', label: '대학원장 인사말' },
  { href: '/about/org', label: '조직도' },
  { href: '/about/history', label: '연혁' },
  { href: '/posts?category=notice', label: '공지사항' }
];

const SUPPORT_LINKS: LinkItem[] = [
  { href: '/faq', label: '자주 묻는 질문' },
  { href: '/support/contact', label: '문의하기' },
  { href: '/terms', label: '이용약관' },
  { href: '/privacy', label: '개인정보처리방침' }
];

const ADMIN_LINKS: Array<LinkItem & { permission: AdminPermissionToken }> = [
  { href: '/admin/posts', label: '게시물 관리', permission: 'admin_posts' },
  { href: '/admin/events', label: '행사 관리', permission: 'admin_events' },
  { href: '/admin/hero', label: '홈 배너 관리', permission: 'admin_hero' },
  { href: '/admin/notifications', label: '알림 관리', permission: 'admin_notifications' },
  { href: '/admin/signup-requests', label: '가입신청 심사', permission: 'admin_signup' },
  { href: '/admin/profile-change-requests', label: '정보변경 심사', permission: 'admin_profile' },
  { href: '/admin/admin-users', label: '관리자 권한', permission: 'admin_roles' },
];

type DrawerMenuProps = {
  status: 'loading' | 'authorized' | 'unauthorized' | 'error';
  onClose: () => void;
};

/**
 * Drawer 내부 메뉴 컴포넌트
 */
export function DrawerMenu({ status, onClose }: DrawerMenuProps) {
  const router = useRouter();
  const { data: session } = useAuth();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const adminLinks = ADMIN_LINKS.filter((link) =>
    hasPermissionSession(session, link.permission)
  );

  return (
    <nav id="primary-navigation" aria-label="전체 메뉴" className="flex h-full flex-col gap-4 overflow-y-auto">
      {/* 로그인/계정 활성화 또는 내 정보/로그아웃 버튼 */}
      {status !== 'authorized' ? (
        <div className="border-b border-neutral-border pb-4">
          <div className="flex gap-2">
            <Link
              href="/login"
              onClick={onClose}
              className="flex-1 flex items-center justify-center gap-2 rounded-[10px] bg-brand-primary px-3 py-2.5 text-white text-sm no-underline hover:no-underline hover:text-white hover:bg-brand-800 transition-colors"
            >
              <svg className="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 14a6 6 0 0 1 12 0" strokeLinecap="round" />
              </svg>
              로그인
            </Link>
            <Link
              href="/signup"
              onClick={onClose}
              className="flex-1 flex items-center justify-center rounded-[10px] border border-brand-primary px-3 py-2.5 text-brand-primary text-sm hover:bg-brand-primary/5 transition-colors whitespace-nowrap"
            >
              신규 가입신청
            </Link>
          </div>
          <Link
            href="/activate"
            onClick={onClose}
            className="mt-2 block text-center text-xs text-text-secondary underline"
          >
            승인 후 계정 활성화
          </Link>
        </div>
      ) : (
        <div className="flex gap-2 border-b border-neutral-border pb-4">
          <Link
            href="/me"
            onClick={onClose}
            className="flex-1 flex items-center justify-center rounded-[10px] border border-brand-primary px-3 py-2.5 text-brand-primary text-sm hover:bg-brand-primary/5 transition-colors"
          >
            내 정보
          </Link>
          <button
            type="button"
            onClick={() => {
              onClose();
              // 로그아웃 후 로그인 화면으로 이동
              void logoutAll().finally(() => {
                router.push('/login');
              });
            }}
            className="flex-1 flex items-center justify-center rounded-[10px] bg-neutral-muted px-3 py-2.5 text-white text-sm hover:bg-neutral-ink transition-colors"
          >
            로그아웃
          </button>
        </div>
      )}

      {/* 동문 수첩 */}
      <Link
        href="/directory"
        onClick={onClose}
        className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-neutral-ink text-sm hover:bg-neutral-subtle transition-colors"
      >
        <svg className="size-5 text-neutral-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 2h10a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
          <path d="M7 6h6M7 10h4" />
        </svg>
        동문 수첩
      </Link>

      {/* 총동문회 소개 (펼침/접힘) */}
      <div>
        <button
          type="button"
          onClick={() => setAboutOpen(!aboutOpen)}
          className="w-full flex items-center justify-between gap-3 rounded-[10px] px-3 py-2.5 text-neutral-ink text-sm hover:bg-neutral-subtle transition-colors"
        >
          <div className="flex items-center gap-3">
            <svg className="size-5 text-neutral-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 13.33L10 4l6 9.33v6.67a1.33 1.33 0 0 1-1.33 1.33H5.33A1.33 1.33 0 0 1 4 20v-6.67Z" />
              <path d="M8 20v-6.67h4V20" />
            </svg>
            총동문회 소개
          </div>
          <svg className={`size-4 text-neutral-muted transition-transform ${aboutOpen ? 'rotate-180' : ''}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {aboutOpen && (
          <ul className="ml-8 mt-1 space-y-1">
            {ABOUT_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={onClose}
                  className="block rounded-[10px] px-3 py-2 text-neutral-muted text-sm hover:bg-neutral-subtle transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 총동문회 소식 */}
      <Link
        href="/posts"
        onClick={onClose}
        className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-neutral-ink text-sm hover:bg-neutral-subtle transition-colors"
      >
        <svg className="size-5 text-neutral-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2.67" y="2.67" width="14" height="14.67" rx="1.33" />
          <path d="M16 5.33h3.33V16a1.33 1.33 0 0 1-1.33 1.33H16V5.33Z" />
        </svg>
        총동문회 소식
      </Link>

      {/* 게시판 */}
      <Link
        href="/board"
        onClick={onClose}
        className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-neutral-ink text-sm hover:bg-neutral-subtle transition-colors"
      >
        <svg className="size-5 text-neutral-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 3h14v11a1 1 0 0 1-1 1H3V3z" />
          <path d="M6 7h8M6 10h8" />
        </svg>
        게시판
      </Link>

      {/* 행사 일정 */}
      <Link
        href="/events"
        onClick={onClose}
        className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-neutral-ink text-sm hover:bg-neutral-subtle transition-colors"
      >
        <svg className="size-5 text-neutral-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="4" width="14" height="13" rx="1" />
          <path d="M3 8h14M7 2v4M13 2v4" />
        </svg>
        행사 일정
      </Link>

      {/* 지원 정보 (펼침/접힘) */}
      <div>
        <button
          type="button"
          onClick={() => setSupportOpen(!supportOpen)}
          className="w-full flex items-center justify-between gap-3 rounded-[10px] px-3 py-2.5 text-neutral-ink text-sm hover:bg-neutral-subtle transition-colors"
        >
          <div className="flex items-center gap-3">
            <svg className="size-5 text-neutral-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="10" cy="10" r="7" />
              <path d="M10 14v.01M10 11a2 2 0 0 1 2-2" />
            </svg>
            지원 정보
          </div>
          <svg className={`size-4 text-neutral-muted transition-transform ${supportOpen ? 'rotate-180' : ''}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {supportOpen && (
          <ul className="ml-8 mt-1 space-y-1">
            {SUPPORT_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={onClose}
                  className="block rounded-[10px] px-3 py-2 text-neutral-muted text-sm hover:bg-neutral-subtle transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 관리자 메뉴 (관리자 등급에서만 섹션 노출, 세부 항목은 permission으로 추가 필터링) */}
      <RequireAdmin fallback={null}>
        <div
          className="border-t border-neutral-border pt-4"
          hidden={adminLinks.length === 0}
        >
          <button
            type="button"
            onClick={() => setAdminOpen(!adminOpen)}
            className="w-full flex items-center justify-between gap-3 rounded-[10px] px-3 py-2.5 text-neutral-ink text-sm hover:bg-neutral-subtle transition-colors"
          >
            <div className="flex items-center gap-3">
              <svg className="size-5 text-neutral-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M10 2l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6l2-6z" />
              </svg>
              관리자 메뉴
            </div>
            <svg className={`size-4 text-neutral-muted transition-transform ${adminOpen ? 'rotate-180' : ''}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {adminOpen && adminLinks.length > 0 && (
            <ul className="ml-8 mt-1 space-y-1">
              {adminLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={onClose}
                    className="block rounded-[10px] px-3 py-2 text-neutral-muted text-sm hover:bg-neutral-subtle transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </RequireAdmin>

      {/* 푸시 알림 구독 CTA */}
      <NotifyCTA />
    </nav>
  );
}
