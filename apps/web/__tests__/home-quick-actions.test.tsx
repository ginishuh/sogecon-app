import { screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import HomePage from '../app/page';
import { HomeActionsView, selectHomeActions } from '../components/home/quick-actions';
import { renderWithProviders } from '../tests/render-with-providers';

describe('Home Quick Actions', () => {
  it('비회원에게 가입부터 첫 로그인까지 필요한 세 행동만 제공한다', () => {
    renderWithProviders(<HomeActionsView status="unauthorized" isAdmin={false} />);
    expect(screen.getByRole('heading', { name: '동문회와 함께하기' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /동문 가입 신청/ })).toHaveAttribute('href', '/signup');
    expect(screen.getByRole('link', { name: /동문 로그인/ })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: /비밀번호 만들기/ })).toHaveAttribute('href', '/activate');
    expect(screen.queryByRole('link', { name: /자유게시판 바로가기/ })).not.toBeInTheDocument();
  });

  it('includes greeting preview card', () => {
    renderWithProviders(<HomePage />);
    // Check greeting call-to-action
    expect(screen.getByRole('link', { name: '총동문회장 인사말' })).toHaveAttribute('href', '/about/greeting');
    expect(screen.getByRole('link', { name: '대학원장 인사말' })).toHaveAttribute('href', '/about/dean-greeting');
    expect(screen.getByRole('img', { name: '김도영 경제대학원장 인사말 이미지 미리보기' })).toHaveAttribute(
      'src',
      '/images/about/dean-kim-doyoung-card.webp',
    );
  });

  it('공지·행사·소식을 같은 최근 활동 영역에 제공한다', () => {
    renderWithProviders(<HomePage />);
    expect(screen.getByRole('heading', { name: '최근 활동' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '공지사항' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '행사안내' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '소식' })).toBeInTheDocument();
  });

  it('회원 행동은 세 개로 제한하고 운영자 행동은 권한별로 제공한다', () => {
    expect(selectHomeActions('authorized', false).map((action) => action.label)).toEqual([
      '동문 찾기',
      '게시판 보기',
      '내 정보 확인',
    ]);
    expect(selectHomeActions('authorized', true, ['super_admin']).map((action) => action.label)).toEqual([
      '가입 신청 확인',
      '공지·소식 관리',
      '행사 일정 관리',
      '알림 관리',
      '홈 배너 관리',
      '정보변경 심사',
      '회원 관리',
      '문의 내역',
    ]);
  });

  it('회원과 운영자 상태를 실제 링크로 렌더링한다', () => {
    const { rerender } = renderWithProviders(<HomeActionsView status="authorized" isAdmin={false} />);
    expect(screen.getByRole('heading', { name: '동문으로 이어가기' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /동문 찾기/ })).toHaveAttribute('href', '/directory');
    expect(screen.getByRole('link', { name: /게시판 보기/ })).toHaveAttribute('href', '/board');
    expect(screen.getByRole('link', { name: /내 정보 확인/ })).toHaveAttribute('href', '/me');

    rerender(<HomeActionsView status="authorized" isAdmin roles={['super_admin']} />);
    expect(screen.getByRole('heading', { name: '오늘의 운영 업무' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /가입 신청 확인/ })).toHaveAttribute('href', '/admin/signup-requests');
    expect(screen.getByRole('link', { name: /공지·소식 관리/ })).toHaveAttribute('href', '/admin/posts');
    expect(screen.getByRole('link', { name: /행사 일정 관리/ })).toHaveAttribute('href', '/admin/events');
    expect(screen.getByRole('link', { name: /알림 관리/ })).toHaveAttribute(
      'href',
      '/admin/notifications',
    );
    expect(screen.getByRole('link', { name: /홈 배너 관리/ })).toHaveAttribute(
      'href',
      '/admin/hero',
    );
    expect(screen.getByRole('link', { name: /정보변경 심사/ })).toHaveAttribute(
      'href',
      '/admin/profile-change-requests',
    );
  });

  it('게시물 전용 관리자는 권한이 있는 운영 행동만 본다', () => {
    renderWithProviders(
      <HomeActionsView
        status="authorized"
        isAdmin
        roles={['member', 'admin', 'admin_posts']}
      />,
    );

    expect(screen.getByRole('heading', { name: '오늘의 운영 업무' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /공지·소식 관리/ })).toHaveAttribute(
      'href',
      '/admin/posts',
    );
    expect(screen.queryByRole('link', { name: /가입 신청 확인/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /행사 일정 관리/ })).not.toBeInTheDocument();
  });

  it('프로필 심사 권한이 있으면 홈 운영 행동에 정보변경 심사를 제공한다', () => {
    renderWithProviders(
      <HomeActionsView
        status="authorized"
        isAdmin
        roles={['member', 'admin', 'admin_posts', 'admin_profile']}
      />,
    );

    expect(screen.getByRole('link', { name: /공지·소식 관리/ })).toHaveAttribute(
      'href',
      '/admin/posts',
    );
    expect(screen.getByRole('link', { name: /정보변경 심사/ })).toHaveAttribute(
      'href',
      '/admin/profile-change-requests',
    );
    expect(screen.queryByRole('link', { name: /가입 신청 확인/ })).not.toBeInTheDocument();
  });

  it('알림 관리 권한이 있으면 홈 운영 행동에 알림 관리를 제공한다', () => {
    renderWithProviders(
      <HomeActionsView
        status="authorized"
        isAdmin
        roles={['member', 'admin', 'admin_posts', 'admin_notifications']}
      />,
    );

    expect(screen.getByRole('link', { name: /공지·소식 관리/ })).toHaveAttribute(
      'href',
      '/admin/posts',
    );
    expect(screen.getByRole('link', { name: /알림 관리/ })).toHaveAttribute(
      'href',
      '/admin/notifications',
    );
    expect(screen.queryByRole('link', { name: /가입 신청 확인/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /행사 일정 관리/ })).not.toBeInTheDocument();
  });

  it('홈 배너 관리 권한이 있으면 홈 운영 행동에 배너 관리를 제공한다', () => {
    renderWithProviders(
      <HomeActionsView
        status="authorized"
        isAdmin
        roles={['member', 'admin', 'admin_posts', 'admin_hero']}
      />,
    );

    expect(screen.getByRole('link', { name: /공지·소식 관리/ })).toHaveAttribute(
      'href',
      '/admin/posts',
    );
    expect(screen.getByRole('link', { name: /홈 배너 관리/ })).toHaveAttribute(
      'href',
      '/admin/hero',
    );
    expect(screen.queryByRole('link', { name: /알림 관리/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /행사 일정 관리/ })).not.toBeInTheDocument();
  });

  it('권한 관리 권한이 있으면 홈 운영 행동에 회원 관리를 제공한다', () => {
    renderWithProviders(
      <HomeActionsView
        status="authorized"
        isAdmin
        roles={['member', 'admin', 'admin_posts', 'admin_roles']}
      />,
    );

    expect(screen.getByRole('link', { name: /공지·소식 관리/ })).toHaveAttribute(
      'href',
      '/admin/posts',
    );
    expect(screen.getByRole('link', { name: /회원 관리/ })).toHaveAttribute(
      'href',
      '/admin/members',
    );
    expect(screen.queryByRole('link', { name: /홈 배너 관리/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /가입 신청 확인/ })).not.toBeInTheDocument();
  });

  it('문의 조회 권한이 있으면 홈 운영 행동에 문의 내역을 제공한다', () => {
    renderWithProviders(
      <HomeActionsView
        status="authorized"
        isAdmin
        roles={['member', 'admin', 'admin_posts', 'admin_support']}
      />,
    );

    expect(screen.getByRole('link', { name: /공지·소식 관리/ })).toHaveAttribute(
      'href',
      '/admin/posts',
    );
    expect(screen.getByRole('link', { name: /문의 내역/ })).toHaveAttribute(
      'href',
      '/admin/support',
    );
    expect(screen.queryByRole('link', { name: /회원 관리/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /가입 신청 확인/ })).not.toBeInTheDocument();
  });

  it('인증 상태를 확인하는 동안 비회원 행동을 먼저 노출하지 않는다', () => {
    renderWithProviders(<HomeActionsView status="loading" isAdmin={false} />);
    expect(screen.getByRole('region', { name: '홈 핵심 행동을 불러오는 중' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /동문 로그인/ })).not.toBeInTheDocument();
  });
});
