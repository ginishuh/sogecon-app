import { fireEvent, render, screen, within } from '@testing-library/react';
import React, { type ReactNode } from 'react';
import { vi } from 'vitest';

import { SiteHeader } from '../components/site-header';

vi.mock('../components/header-auth', () => ({
  HeaderAuth: () => <div data-testid="header-auth">header-auth-placeholder</div>,
}));

vi.mock('../components/notify-cta', () => ({
  NotifyCTA: () => <button type="button">알림 설정</button>,
}));

vi.mock('../components/require-member', () => ({
  RequireMember: ({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) => (
    <>{children || fallback || null}</>
  ),
}));

vi.mock('../components/require-admin', () => ({
  RequireAdmin: ({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) => (
    <>{children || fallback || null}</>
  ),
}));

describe('SiteHeader mobile drawer', () => {
  it('opens drawer and restores focus on close', async () => {
    render(<SiteHeader />);
    const toggle = screen.getByLabelText('전체 메뉴 열기');
    toggle.focus();
    fireEvent.click(toggle);

    const dialog = await screen.findByRole('dialog', { name: '전체 메뉴' });
    // 패널 포커스 이동 확인
    await screen.findByLabelText('모바일 주 메뉴');
    expect(dialog).toBeInTheDocument();

    // 내비 내용 스모크
    const mobileNav = screen.getByLabelText('모바일 주 메뉴');
    expect(within(mobileNav).getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '/faq');

    // Backdrop 클릭으로 닫기
    fireEvent.click(screen.getByLabelText('닫기'));

    // Drawer 언마운트 후 토글 버튼으로 포커스 복귀
    await screen.findByLabelText('전체 메뉴 열기');
    expect(toggle).toHaveFocus();
  });

  it('closes with Escape and restores focus', async () => {
    render(<SiteHeader />);
    const toggle = screen.getByLabelText('전체 메뉴 열기');
    toggle.focus();
    fireEvent.click(toggle);
    await screen.findByRole('dialog', { name: '전체 메뉴' });

    // ESC로 닫기
    fireEvent.keyDown(document, { key: 'Escape' });

    // Drawer 닫히고 포커스 복귀
    await screen.findByLabelText('전체 메뉴 열기');
    expect(toggle).toHaveFocus();
  });

  it('closes via ESC and via backdrop click, then restores focus', async () => {
    render(<SiteHeader />);
    const toggle = screen.getByLabelText('전체 메뉴 열기');
    toggle.focus();
    fireEvent.click(toggle);

    await screen.findByRole('dialog', { name: '전체 메뉴' });

    // ESC 닫기
    fireEvent.keyDown(document, { key: 'Escape' });
    await screen.findByLabelText('전체 메뉴 열기');
    expect(toggle).toHaveFocus();

    // 다시 열고 Backdrop 클릭 닫기
    fireEvent.click(toggle);
    await screen.findByRole('dialog', { name: '전체 메뉴' });
    const backdrop = document.querySelector('div[aria-hidden="true"]');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop as Element);
    await screen.findByLabelText('전체 메뉴 열기');
    expect(toggle).toHaveFocus();
  });
});
