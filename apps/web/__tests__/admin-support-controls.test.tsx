import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminSupportPage, { SupportFilters } from '../app/admin/support/page';
import { listAdminSupportTickets } from '../services/support';

const mocks = vi.hoisted(() => ({
  auth: {
    status: 'loading' as 'loading' | 'authorized' | 'error',
    data: undefined as
      | undefined
      | {
          kind: 'admin';
          student_id: string;
          email: string;
          name: string;
          roles: string[];
        },
  },
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('../services/support', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services/support')>();
  return {
    ...original,
    listAdminSupportTickets: vi.fn(),
  };
});

function QueryProvider({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('문의 관리자 인증과 권한 경계', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.status = 'loading';
    mocks.auth.data = undefined;
  });

  it('인증 확인 중에는 비로그인 문구와 문의 API를 먼저 노출하지 않는다', () => {
    render(<AdminSupportPage />, { wrapper: QueryProvider });

    expect(screen.getByText('관리자 권한을 확인하고 있습니다.')).toBeInTheDocument();
    expect(screen.queryByText('관리자 로그인이 필요합니다.')).not.toBeInTheDocument();
    expect(listAdminSupportTickets).not.toHaveBeenCalled();
  });

  it('세션 조회 오류를 비로그인 상태와 구분한다', () => {
    mocks.auth.status = 'error';
    render(<AdminSupportPage />, { wrapper: QueryProvider });

    expect(screen.getByText('로그인 상태를 확인하지 못했습니다.')).toBeInTheDocument();
    expect(screen.queryByText('관리자 로그인이 필요합니다.')).not.toBeInTheDocument();
    expect(listAdminSupportTickets).not.toHaveBeenCalled();
  });

  it('admin_support 권한이 없으면 문의 API를 요청하지 않는다', () => {
    mocks.auth.status = 'authorized';
    mocks.auth.data = {
      kind: 'admin',
      student_id: 'e2e',
      email: 'e2e@example.com',
      name: '제한 관리자',
      roles: ['member', 'admin', 'admin_posts'],
    };

    render(<AdminSupportPage />, { wrapper: QueryProvider });

    expect(screen.getByText('해당 화면 접근 권한이 없습니다.')).toBeInTheDocument();
    expect(listAdminSupportTickets).not.toHaveBeenCalled();
  });
});

describe('문의 목록 조작 접근성', () => {
  it('조회 개수·검색·새로고침을 visible label과 44px focus 계약으로 제공한다', () => {
    render(
      <SupportFilters
        limit={50}
        search=""
        onChangeLimit={vi.fn()}
        onChangeSearch={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    for (const name of ['조회 개수', '검색']) {
      const control = screen.getByLabelText(name);
      expect(control).toHaveClass('min-h-11');
      expect(control).toHaveClass('focus-visible:ring-2');
    }
    const refresh = screen.getByRole('button', { name: '새로고침' });
    expect(refresh).toHaveClass('min-h-11');
    expect(refresh).toHaveClass('focus-visible:ring-2');
  });
});
