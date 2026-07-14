import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import React, { type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import GreetingPage from '../app/about/greeting/page';
import DeanGreetingPage from '../app/about/dean-greeting/page';
import OrgPage from '../app/about/org/page';
import HistoryPage from '../app/about/history/page';
import ClassPresidentsPage from '../app/about/class-presidents/page';
import { renderSiteHeaderWithProviders } from './helpers/render-site-header-with-providers';

// DrawerMenu dynamic import mock
vi.mock('../components/lazy', () => ({
  LazyDrawerMenu: ({ onClose }: { onClose: () => void }) => (
    <nav aria-label="전체 메뉴">
      <button type="button" onClick={onClose}>닫기</button>
      <a href="/about/greeting">총동문회장 인사말</a>
      <a href="/about/dean-greeting">대학원장 인사말</a>
      <a href="/about/org">조직도</a>
      <a href="/about/class-presidents">역대 원우회장</a>
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
    expect(screen.getByRole('img', { name: '총동문회장 인사말' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '‘서강학파’의 일원이 되신 것을 환영합니다' })).toBeInTheDocument();
    expect(screen.getByText('감사합니다.')).toBeInTheDocument();
    expect(asFragment()).toMatchSnapshot();
  });

  it('renders the current organization structure', () => {
    const { asFragment } = render(<OrgPage />);
    expect(screen.getByRole('heading', { level: 1, name: '동문회 조직도' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '현재 운영진과 역할' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '행사장에서 대화를 나누는 서강 경제 동문들' })).toHaveAttribute('data-priority', 'true');
    expect(screen.getByRole('heading', { level: 3, name: '운영 방향과 점검' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: '실행 조직' })).toBeInTheDocument();
    expect(screen.getByText(/회장단과 사무국, 분과 운영진이 역할을 나누어/)).toBeInTheDocument();
    expect(screen.queryByText(/반응형·접근성 기준/)).not.toBeInTheDocument();
    expect(screen.getByText('허민철')).toBeInTheDocument();
    expect(screen.getByText('황승환')).toBeInTheDocument();
    expect(screen.getByText('ESG 연구 분과위원장')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '사무국에 문의하기' })).toHaveAttribute('href', '/support/contact');
    expect(asFragment()).toMatchSnapshot();
  });

  it('renders the current dean greeting from the official source', () => {
    render(<DeanGreetingPage />);
    expect(screen.getByRole('heading', { level: 1, name: /우리 서강경제에서/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '서강대학교 경제대학원에 오신 것을 환영합니다' })).toBeInTheDocument();
    expect(screen.getAllByText(/김도영/).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: '서강대학교 경제대학 공식 홈페이지' })).toHaveAttribute(
      'href',
      'https://econ.sogang.ac.kr/econ/1708/subview.do'
    );
  });

  it('renders searchable class president records including official gaps', () => {
    render(<ClassPresidentsPage />);
    expect(screen.getByRole('heading', { level: 1, name: '역대 기수별 원우회장' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '서강대학교 알바트로스탑' })).toHaveAttribute('data-priority', 'true');
    const search = screen.getByRole('searchbox', { name: '기수, 이름 또는 근무처 검색' });
    expect(search).toBeInTheDocument();
    expect(screen.getByText('허민철')).toBeInTheDocument();
    expect(screen.getAllByText('공식 명단 미기재')).toHaveLength(2);

    fireEvent.change(search, { target: { value: '트라움자원' } });
    expect(screen.getByText('1개 기수')).toBeInTheDocument();
    expect(screen.getByText('허민철')).toBeInTheDocument();
    expect(screen.queryByText('송성기')).not.toBeInTheDocument();

    expect(screen.getByRole('link', { name: '서강대학교 경제대학 원문 보기' })).toHaveAttribute(
      'href',
      'https://econ.sogang.ac.kr/econ/1699/subview.do'
    );
  });

  it('renders a preparation state while official alumni president records are verified', () => {
    const { asFragment } = render(<HistoryPage />);
    expect(screen.getByRole('img', { name: '서강대학교 정문과 교정' })).toHaveAttribute('data-priority', 'true');
    expect(screen.getByRole('heading', { level: 1, name: '역대 회장단과 연혁' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '역대 총동문회장 명단을 준비하고 있습니다' })).toBeInTheDocument();
    expect(screen.getByText(/현재 9대 총동문회장은 47기 허민철 회장입니다/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '현재 조직도 보기' })).toHaveAttribute('href', '/about/org');
    expect(screen.getByRole('link', { name: '역대 원우회장 보기' })).toHaveAttribute('href', '/about/class-presidents');
    expect(screen.queryByText('16대 회장 김서강')).not.toBeInTheDocument();
    expect(asFragment()).toMatchSnapshot();
  });
});

describe('SiteHeader navigation', () => {
  it('exposes about links through drawer menu', () => {
    renderSiteHeaderWithProviders();
    const toggleButton = screen.getByLabelText('전체 메뉴 열기');
    fireEvent.click(toggleButton);

    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    const drawerNav = screen.getByLabelText('전체 메뉴');
    expect(within(drawerNav).getByRole('link', { name: '총동문회장 인사말' })).toHaveAttribute('href', '/about/greeting');
    expect(within(drawerNav).getByRole('link', { name: '대학원장 인사말' })).toHaveAttribute('href', '/about/dean-greeting');
    expect(within(drawerNav).getByRole('link', { name: '조직도' })).toHaveAttribute('href', '/about/org');
    expect(within(drawerNav).getByRole('link', { name: '역대 원우회장' })).toHaveAttribute('href', '/about/class-presidents');
    expect(within(drawerNav).getByRole('link', { name: '역대 회장단' })).toHaveAttribute('href', '/about/history');
    expect(within(drawerNav).getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '/faq');
    expect(within(drawerNav).getByRole('link', { name: '개인정보 처리방침' })).toHaveAttribute('href', '/privacy');
    expect(within(drawerNav).getByRole('link', { name: '이용약관' })).toHaveAttribute('href', '/terms');
  });
});
