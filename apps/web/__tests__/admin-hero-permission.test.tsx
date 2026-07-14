import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminHeroEditPage from '../app/admin/hero/[id]/edit/page';
import AdminHeroNewPage from '../app/admin/hero/new/page';
import AdminHeroPage from '../app/admin/hero/page';
import { ToastProvider } from '../components/toast';
import { getAdminHeroItem, listAdminHeroItems } from '../services/hero';

const mocks = vi.hoisted(() => ({
  auth: {
    status: 'authorized',
    data: { roles: ['member', 'admin', 'admin_posts'] },
  },
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '1' }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('../services/hero', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services/hero')>();
  return {
    ...original,
    getAdminHeroItem: vi.fn(),
    listAdminHeroItems: vi.fn(),
  };
});

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

function setRoles(roles: string[]) {
  mocks.auth.status = 'authorized';
  mocks.auth.data = { roles };
}

describe('홈 배너 관리자 페이지 권한 경계', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRoles(['member', 'admin', 'admin_posts']);
  });

  it('인증 확인 중에는 로그인 필요 문구 대신 권한 확인 상태를 표시한다', () => {
    mocks.auth.status = 'loading';

    render(<AdminHeroEditPage />, { wrapper: Providers });

    expect(screen.getByText('관리자 권한을 확인하고 있습니다.')).toBeInTheDocument();
    expect(screen.queryByText('관리자 로그인이 필요합니다.')).not.toBeInTheDocument();
    expect(getAdminHeroItem).not.toHaveBeenCalled();
  });

  it('admin_hero 권한이 없으면 목록 API를 요청하지 않는다', async () => {
    render(<AdminHeroPage />, { wrapper: Providers });

    expect(await screen.findByText('해당 화면 접근 권한이 없습니다.')).toBeInTheDocument();
    expect(listAdminHeroItems).not.toHaveBeenCalled();
  });

  it('admin_hero 권한이 없으면 수정 대상 API도 요청하지 않는다', async () => {
    render(<AdminHeroEditPage />, { wrapper: Providers });

    expect(await screen.findByText('해당 화면 접근 권한이 없습니다.')).toBeInTheDocument();
    expect(getAdminHeroItem).not.toHaveBeenCalled();
  });

  it('admin_hero 권한이 있으면 목록 API를 요청한다', async () => {
    setRoles(['member', 'admin', 'admin_posts', 'admin_hero']);
    vi.mocked(listAdminHeroItems).mockResolvedValue({ items: [], total: 0 });

    render(<AdminHeroPage />, { wrapper: Providers });

    await waitFor(() => {
      expect(listAdminHeroItems).toHaveBeenCalledWith({ limit: 50, offset: 0 });
    });
    expect(screen.queryByText('해당 화면 접근 권한이 없습니다.')).not.toBeInTheDocument();
  });

  it('admin_hero 권한이 있으면 새 배너 화면에 진입한다', () => {
    setRoles(['member', 'admin', 'admin_posts', 'admin_hero']);

    render(<AdminHeroNewPage />, { wrapper: Providers });

    expect(screen.getByRole('heading', { name: '새 배너 추가' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '홈 배너 관리' })).toHaveClass('min-h-11');
    expect(screen.queryByText('해당 화면 접근 권한이 없습니다.')).not.toBeInTheDocument();
  });

  it('admin_hero 권한이 있으면 수정 대상 API를 요청한다', async () => {
    setRoles(['member', 'admin', 'admin_posts', 'admin_hero']);
    vi.mocked(getAdminHeroItem).mockImplementation(() => new Promise(() => undefined));

    render(<AdminHeroEditPage />, { wrapper: Providers });

    await waitFor(() => {
      expect(getAdminHeroItem).toHaveBeenCalledWith(1);
    });
    expect(screen.getByRole('heading', { name: '배너 수정' })).toBeInTheDocument();
    expect(screen.queryByText('해당 화면 접근 권한이 없습니다.')).not.toBeInTheDocument();
  });
});
