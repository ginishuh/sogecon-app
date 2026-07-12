"use client";

import type { Route } from 'next';
import Link from 'next/link';
import React from 'react';

import { useAuth, type AuthStatus } from '../../hooks/useAuth';
import { isAdminSession } from '../../lib/rbac';

type HomeAction = {
  href: Route;
  eyebrow: string;
  label: string;
  description: string;
};

const GUEST_ACTIONS: HomeAction[] = [
  {
    href: '/signup',
    eyebrow: '처음 방문했다면',
    label: '동문 가입 신청',
    description: '기본 정보를 보내고 사무국 확인을 요청합니다.',
  },
  {
    href: '/login',
    eyebrow: '이미 비밀번호가 있다면',
    label: '동문 로그인',
    description: '동문 수첩과 게시판 등 전용 메뉴를 이용합니다.',
  },
  {
    href: '/activate',
    eyebrow: '가입 승인 안내를 받았다면',
    label: '비밀번호 만들기',
    description: '안내 링크 또는 코드로 첫 로그인을 준비합니다.',
  },
];

const MEMBER_ACTIONS: HomeAction[] = [
  {
    href: '/directory',
    eyebrow: '서로 연결되는 동문',
    label: '동문 찾기',
    description: '기수와 분야로 동문을 찾고 인연을 이어갑니다.',
  },
  {
    href: '/board',
    eyebrow: '함께 나누는 이야기',
    label: '게시판 보기',
    description: '자유게시판과 경조사 소식을 한곳에서 확인합니다.',
  },
  {
    href: '/me',
    eyebrow: '내 정보와 활동',
    label: '내 정보 확인',
    description: '회원 정보와 가입 행사 등 나의 활동을 확인합니다.',
  },
];

const ADMIN_ACTIONS: HomeAction[] = [
  {
    href: '/admin/signup-requests',
    eyebrow: '새 동문 맞이',
    label: '가입 신청 확인',
    description: '대기 중인 가입 신청을 확인하고 안내를 이어갑니다.',
  },
  {
    href: '/admin/posts',
    eyebrow: '홈 소식 운영',
    label: '공지·소식 관리',
    description: '홈에 표시할 중요 공지와 동문 소식을 관리합니다.',
  },
  {
    href: '/admin/events',
    eyebrow: '행사 운영',
    label: '행사 일정 관리',
    description: '다가오는 행사와 신청 정보를 관리합니다.',
  },
];

const ERROR_ACTIONS: HomeAction[] = [
  {
    href: '/faq',
    eyebrow: '이용 방법이 궁금하다면',
    label: '자주 묻는 질문',
    description: '로그인과 동문 전용 메뉴 이용 방법을 확인합니다.',
  },
  {
    href: '/support/contact',
    eyebrow: '도움이 필요하다면',
    label: '사무국에 문의하기',
    description: '홈페이지 이용 문제를 동문회 사무국에 알려 주세요.',
  },
  {
    href: '/events',
    eyebrow: '공개 소식부터 확인',
    label: '행사 일정 보기',
    description: '로그인 없이 공개된 동문회 행사 일정을 확인합니다.',
  },
];

export function selectHomeActions(status: AuthStatus, isAdmin: boolean): HomeAction[] {
  if (status === 'error') return ERROR_ACTIONS;
  if (status !== 'authorized') return GUEST_ACTIONS;
  return isAdmin ? ADMIN_ACTIONS : MEMBER_ACTIONS;
}

export function HomeActionsView({ status, isAdmin }: { status: AuthStatus; isAdmin: boolean }) {
  if (status === 'loading') {
    return (
      <section aria-label="홈 핵심 행동을 불러오는 중" className="mt-8 space-y-4">
        <div className="h-12 w-48 animate-pulse rounded-lg bg-neutral-subtle" />
        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={`home-action-loading-${index}`} className="min-h-32 animate-pulse rounded-2xl bg-neutral-subtle" />
          ))}
        </div>
      </section>
    );
  }

  const actions = selectHomeActions(status, isAdmin);
  const heading = isAdmin ? '오늘의 운영 업무' : status === 'authorized' ? '동문으로 이어가기' : status === 'error' ? '홈 이용 안내' : '동문회와 함께하기';

  return (
    <section aria-labelledby="home-actions" className="mt-8 space-y-4">
      <div>
        <p className="text-xs font-semibold text-brand-700">바로 시작하기</p>
        <h2 id="home-actions" className="mt-1 text-xl font-semibold text-text-primary">{heading}</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {actions.map((action, index) => (
          <Link
            key={action.href}
            href={action.href}
            className={`group min-h-32 rounded-2xl border p-5 no-underline transition hover:-translate-y-0.5 hover:no-underline hover:shadow-md focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
              index === 0 ? 'border-brand-200 bg-brand-50' : 'border-neutral-border bg-white'
            }`}
          >
            <span className="text-xs font-medium text-text-muted">{action.eyebrow}</span>
            <strong className="mt-2 flex items-center justify-between text-base text-text-primary">
              {action.label}<span aria-hidden="true" className="text-brand-700 transition-transform group-hover:translate-x-1">→</span>
            </strong>
            <span className="mt-2 block text-sm leading-6 text-text-secondary">{action.description}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function HomeQuickActions() {
  const auth = useAuth();
  const isAdmin = auth.status === 'authorized' && isAdminSession(auth.data);
  return <HomeActionsView status={auth.status} isAdmin={isAdmin} />;
}

export default HomeQuickActions;
