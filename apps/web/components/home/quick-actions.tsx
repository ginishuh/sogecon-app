"use client";

import type { Route } from 'next';
import Link from 'next/link';
import React from 'react';
import {
  Article,
  ArrowRight,
  CalendarDots,
  ChatCircleText,
  IdentificationCard,
  ImageSquare,
  Key,
  Megaphone,
  Question,
  SignIn,
  UserCircle,
  UserPlus,
  UsersThree,
} from '@phosphor-icons/react';

import { useAuth, type AuthStatus } from '../../hooks/useAuth';
import {
  hasPermission,
  isAdminSession,
  type AdminPermissionToken,
} from '../../lib/rbac';

type HomeAction = {
  href: Route;
  eyebrow: string;
  label: string;
  description: string;
  icon: React.ElementType;
  permission?: AdminPermissionToken;
};

const GUEST_ACTIONS: HomeAction[] = [
  {
    href: '/signup',
    eyebrow: '처음 방문했다면',
    label: '동문 가입 신청',
    description: '기본 정보를 보내고 사무국 확인을 요청합니다.',
    icon: UserPlus,
  },
  {
    href: '/login',
    eyebrow: '이미 비밀번호가 있다면',
    label: '동문 로그인',
    description: '동문 수첩과 게시판 등 전용 메뉴를 이용합니다.',
    icon: SignIn,
  },
  {
    href: '/activate',
    eyebrow: '가입 승인 안내를 받았다면',
    label: '비밀번호 만들기',
    description: '안내 링크 또는 코드로 첫 로그인을 준비합니다.',
    icon: Key,
  },
];

const MEMBER_ACTIONS: HomeAction[] = [
  {
    href: '/directory',
    eyebrow: '서로 연결되는 동문',
    label: '동문 찾기',
    description: '기수와 분야로 동문을 찾고 인연을 이어갑니다.',
    icon: UsersThree,
  },
  {
    href: '/board',
    eyebrow: '함께 나누는 이야기',
    label: '게시판 보기',
    description: '자유게시판과 경조사 소식을 한곳에서 확인합니다.',
    icon: Article,
  },
  {
    href: '/me',
    eyebrow: '내 정보와 활동',
    label: '내 정보 확인',
    description: '회원 정보와 가입 행사 등 나의 활동을 확인합니다.',
    icon: UserCircle,
  },
];

const ADMIN_ACTIONS: HomeAction[] = [
  {
    href: '/admin/signup-requests',
    eyebrow: '새 동문 맞이',
    label: '가입 신청 확인',
    description: '대기 중인 가입 신청을 확인하고 안내를 이어갑니다.',
    icon: UserPlus,
    permission: 'admin_signup',
  },
  {
    href: '/admin/posts',
    eyebrow: '홈 소식 운영',
    label: '공지·소식 관리',
    description: '홈에 표시할 중요 공지와 동문 소식을 관리합니다.',
    icon: Megaphone,
    permission: 'admin_posts',
  },
  {
    href: '/admin/events',
    eyebrow: '행사 운영',
    label: '행사 일정 관리',
    description: '다가오는 행사와 신청 정보를 관리합니다.',
    icon: CalendarDots,
    permission: 'admin_events',
  },
  {
    href: '/admin/notifications',
    eyebrow: '새 소식 전달',
    label: '알림 관리',
    description: '알림 발송 현황을 확인하고 운영 상태를 관리합니다.',
    icon: Megaphone,
    permission: 'admin_notifications',
  },
  {
    href: '/admin/hero',
    eyebrow: '홈 첫 화면 운영',
    label: '홈 배너 관리',
    description: '홈에 노출할 주요 게시물과 행사 배너를 관리합니다.',
    icon: ImageSquare,
    permission: 'admin_hero',
  },
  {
    href: '/admin/profile-change-requests',
    eyebrow: '회원 정보 확인',
    label: '정보변경 심사',
    description: '이름과 기수 변경 요청을 확인하고 처리합니다.',
    icon: IdentificationCard,
    permission: 'admin_profile',
  },
  {
    href: '/admin/members',
    eyebrow: '회원 현황 확인',
    label: '회원 관리',
    description: '회원 정보를 조회하고 역할 운영 범위를 확인합니다.',
    icon: UsersThree,
    permission: 'admin_roles',
  },
  {
    href: '/admin/support',
    eyebrow: '문의 응대',
    label: '문의 내역',
    description: '접수된 홈페이지 문의를 확인하고 후속 대응을 준비합니다.',
    icon: ChatCircleText,
    permission: 'admin_support',
  },
];

const ERROR_ACTIONS: HomeAction[] = [
  {
    href: '/faq',
    eyebrow: '이용 방법이 궁금하다면',
    label: '자주 묻는 질문',
    description: '로그인과 동문 전용 메뉴 이용 방법을 확인합니다.',
    icon: Question,
  },
  {
    href: '/support/contact',
    eyebrow: '도움이 필요하다면',
    label: '사무국에 문의하기',
    description: '홈페이지 이용 문제를 동문회 사무국에 알려 주세요.',
    icon: ChatCircleText,
  },
  {
    href: '/events',
    eyebrow: '공개 소식부터 확인',
    label: '행사 일정 보기',
    description: '로그인 없이 공개된 동문회 행사 일정을 확인합니다.',
    icon: CalendarDots,
  },
];

export function selectHomeActions(
  status: AuthStatus,
  isAdmin: boolean,
  roles: readonly string[] = [],
): HomeAction[] {
  if (status === 'error') return ERROR_ACTIONS;
  if (status !== 'authorized') return GUEST_ACTIONS;
  if (!isAdmin) return MEMBER_ACTIONS;

  const allowedAdminActions = ADMIN_ACTIONS.filter(
    (action) => action.permission && hasPermission(roles, action.permission),
  );
  return allowedAdminActions.length > 0 ? allowedAdminActions : MEMBER_ACTIONS;
}

export function HomeActionsView({
  status,
  isAdmin,
  roles = [],
}: {
  status: AuthStatus;
  isAdmin: boolean;
  roles?: readonly string[];
}) {
  if (status === 'loading') {
    return (
      <section aria-label="홈 핵심 행동을 불러오는 중" className="relative z-10 mt-6 lg:-mt-8 lg:px-4">
        <div className="grid overflow-hidden rounded-2xl border border-neutral-border bg-white shadow-md md:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={`home-action-loading-${index}`} className="min-h-36 animate-pulse border-b border-neutral-border bg-neutral-subtle last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0" />
          ))}
        </div>
      </section>
    );
  }

  const actions = selectHomeActions(status, isAdmin, roles);
  const hasAdminActions = actions.some((action) => action.permission !== undefined);
  const heading = hasAdminActions ? '오늘의 운영 업무' : status === 'authorized' ? '동문으로 이어가기' : status === 'error' ? '홈 이용 안내' : '동문회와 함께하기';

  return (
    <section aria-labelledby="home-actions" className="relative z-10 mt-6 lg:-mt-8 lg:px-4">
      <h2 id="home-actions" className="sr-only">{heading}</h2>
      <div className="grid overflow-hidden rounded-2xl border border-neutral-border bg-white shadow-md md:grid-cols-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
          <Link
            key={action.href}
            href={action.href}
            className="group grid min-h-36 grid-cols-[3.5rem_1fr_auto] items-center gap-4 border-b border-neutral-border px-5 py-5 no-underline transition hover:bg-brand-50/70 hover:no-underline focus-visible:z-10 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset md:min-h-40 md:grid-cols-[3.25rem_1fr_auto] md:border-b-0 md:border-r md:px-6 md:last:border-r-0"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700 transition group-hover:bg-brand-100">
              <Icon aria-hidden="true" size={28} weight="regular" />
            </span>
            <span className="min-w-0">
              <span className="block text-[0.7rem] font-medium text-text-muted">{action.eyebrow}</span>
              <strong className="mt-1 block text-base font-semibold text-text-primary md:text-[1.05rem]">{action.label}</strong>
              <span className="mt-1 block text-sm leading-5 text-text-secondary">{action.description}</span>
            </span>
            <ArrowRight aria-hidden="true" size={21} weight="bold" className="text-brand-700 transition-transform group-hover:translate-x-1" />
          </Link>
          );
        })}
      </div>
    </section>
  );
}

export function HomeQuickActions() {
  const auth = useAuth();
  const isAdmin = auth.status === 'authorized' && isAdminSession(auth.data);
  return <HomeActionsView status={auth.status} isAdmin={isAdmin} roles={auth.data?.roles} />;
}

export default HomeQuickActions;
