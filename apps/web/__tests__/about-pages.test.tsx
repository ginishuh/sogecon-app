import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import React, { type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import GreetingPage from '../app/about/greeting/page';
import OrgPage from '../app/about/org/page';
import HistoryPage from '../app/about/history/page';
import { SiteHeader } from '../components/site-header';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// DrawerMenu dynamic import mock
vi.mock('../components/lazy', () => ({
  LazyDrawerMenu: ({ onClose }: { onClose: () => void }) => (
    <nav aria-label="전체 메뉴">
      <button type="button" onClick={onClose}>닫기</button>
      <a href="/about/greeting">회장 인사말</a>
      <a href="/about/org">조직도</a>
      <a href="/about/history">역대 회장단</a>
      <a href="/faq">FAQ</a>
      <a href="/privacy">개인정보 처리방침</a>
      <a href="/terms">이용약관</a>
    </nav>
  ),
}));

vi.mock('../components/require-admin', () => ({
  RequireAdmin: ({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) => (
    <>{children || fallback || null}</>
  )
}));

afterEach(() => {
  cleanup();
});

describe('About static pages', () => {
  it('renders greeting page hero and sections', () => {
    const { asFragment } = render(<GreetingPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('회장 인사말');
    expect(screen.getByLabelText('총동문회 비전 다이어그램')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '디지털 허브 완성' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: '총동문회 운영 원칙 목록' })).toBeInTheDocument();
    expect(asFragment()).toMatchSnapshot();
  });

  it('renders organization page with contact list', () => {
    const { asFragment } = render(<OrgPage />);
    expect(screen.getByRole('heading', { name: '분과별 주요 역할' })).toBeInTheDocument();
    expect(screen.getByLabelText('사무국 연락처 정보')).toBeInTheDocument();
    expect(screen.getByText('소통분과')).toBeInTheDocument();
    expect(screen.getByText('대표 전화')).toBeInTheDocument();
    expect(asFragment()).toMatchSnapshot();
  });

  it('renders history page timeline and archive', () => {
    const { asFragment } = render(<HistoryPage />);
    expect(screen.getByRole('list', { name: '총동문회 주요 연혁' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '공식 웹 런치' })).toBeInTheDocument();
    expect(screen.getByText('16대 회장 김서강')).toBeInTheDocument();
    expect(asFragment()).toMatchSnapshot();
  });
});

describe('SiteHeader navigation', () => {
  it('exposes about links through drawer menu', () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <SiteHeader />
      </QueryClientProvider>
    );
    const toggleButton = screen.getByLabelText('전체 메뉴 열기');
    fireEvent.click(toggleButton);

    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    const drawerNav = screen.getByLabelText('전체 메뉴');
    expect(within(drawerNav).getByRole('link', { name: '회장 인사말' })).toHaveAttribute('href', '/about/greeting');
    expect(within(drawerNav).getByRole('link', { name: '조직도' })).toHaveAttribute('href', '/about/org');
    expect(within(drawerNav).getByRole('link', { name: '역대 회장단' })).toHaveAttribute('href', '/about/history');
    expect(within(drawerNav).getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '/faq');
    expect(within(drawerNav).getByRole('link', { name: '개인정보 처리방침' })).toHaveAttribute('href', '/privacy');
    expect(within(drawerNav).getByRole('link', { name: '이용약관' })).toHaveAttribute('href', '/terms');
  });
});
