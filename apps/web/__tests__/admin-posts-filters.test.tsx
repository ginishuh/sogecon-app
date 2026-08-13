import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminPostsPage from '../app/admin/posts/page';
import { ToastProvider } from '../components/toast';

const mocks = vi.hoisted(() => ({
  auth: {
    status: 'authorized' as const,
    data: { roles: ['member', 'admin', 'admin_posts'] },
  },
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('../services/posts', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services/posts')>();
  return {
    ...original,
    listAdminPosts: vi.fn(async () => ({ items: [], total: 0 })),
    deletePost: vi.fn(),
  };
});

vi.mock('../hooks/useHeroTargetControls', () => ({
  useHeroTargetControls: () => ({
    itemsByTargetId: new Map(),
    pendingTargetId: null,
    toggle: vi.fn(),
  }),
}));

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

describe('관리자 게시물 필터 접근성', () => {
  beforeEach(() => {
    mocks.auth.status = 'authorized';
    mocks.auth.data = { roles: ['member', 'admin', 'admin_posts'] };
  });

  it('카테고리·상태·검색어를 명시적 label에 연결한다', async () => {
    render(<AdminPostsPage />, { wrapper: Providers });

    expect(await screen.findByLabelText('카테고리')).toBeInTheDocument();
    expect(screen.getByLabelText('상태')).toBeInTheDocument();
    expect(screen.getByLabelText('검색어')).toBeInTheDocument();
  });
});
