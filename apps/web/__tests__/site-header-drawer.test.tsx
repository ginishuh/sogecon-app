import { fireEvent, render, screen } from '@testing-library/react';
import React, { type ReactNode } from 'react';
import { vi } from 'vitest';

import { SiteHeader } from '../components/site-header';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// DrawerMenu dynamic import mock — 닫기 버튼은 실제 Drawer 헤더에서 제공
vi.mock('../components/lazy', () => ({
  LazyDrawerMenu: () => (
    <nav aria-label="전체 메뉴">
      <a href="/faq">FAQ</a>
      <a href="/about/greeting">총동문회장 인사말</a>
      <a href="/about/dean-greeting">대학원장 인사말</a>
    </nav>
  ),
}));

vi.mock('../components/require-admin', () => ({
  RequireAdmin: ({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) => (
    <>{children || fallback || null}</>
  ),
}));

describe('SiteHeader drawer', () => {
  it('opens drawer and closes on button click', async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <SiteHeader />
      </QueryClientProvider>
    );
    const toggle = screen.getByLabelText('전체 메뉴 열기');
    toggle.focus();
    fireEvent.click(toggle);

    const dialog = await screen.findByRole('dialog', { name: '메뉴' });
    expect(dialog).toBeInTheDocument();

    // 실제 Drawer 헤더의 닫기 버튼 클릭
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));

    // Drawer 닫힘 확인
    await screen.findByLabelText('전체 메뉴 열기');
  });

  it('closes with Escape key', async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <SiteHeader />
      </QueryClientProvider>
    );
    const toggle = screen.getByLabelText('전체 메뉴 열기');
    toggle.focus();
    fireEvent.click(toggle);
    await screen.findByRole('dialog', { name: '메뉴' });

    // ESC로 닫기
    fireEvent.keyDown(document, { key: 'Escape' });

    // Drawer 닫힘 확인
    await screen.findByLabelText('전체 메뉴 열기');
  });
});
