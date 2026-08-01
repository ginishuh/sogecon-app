import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import BoardEditPage from '../app/board/[id]/edit/page';

const mocks = vi.hoisted(() => ({
  auth: {
    status: 'authorized' as const,
    data: { id: 1, roles: ['member', 'admin', 'admin_hero'] },
  },
  getPost: vi.fn(),
  updatePost: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '42' }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('../components/toast', () => ({
  useToast: () => ({ show: vi.fn() }),
}));

vi.mock('../services/posts', () => ({
  getPost: (...args: unknown[]) => mocks.getPost(...args),
  updatePost: (...args: unknown[]) => mocks.updatePost(...args),
}));

vi.mock('../components/post-form', () => ({
  PostForm: ({ hideAdminOptions }: { hideAdminOptions?: boolean }) => (
    <div data-testid="post-form" data-hide-admin-options={String(hideAdminOptions)} />
  ),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <BoardEditPage />
    </QueryClientProvider>,
  );
}

describe('게시판 글 수정 권한 경계', () => {
  beforeEach(() => {
    mocks.auth = {
      status: 'authorized',
      data: { id: 1, roles: ['member', 'admin', 'admin_hero'] },
    };
    mocks.getPost.mockReset();
    mocks.updatePost.mockReset();
    mocks.getPost.mockResolvedValue({
      id: 42,
      title: '게시판 글',
      content: '본문',
      category: 'discussion',
      author_id: 99,
      published_at: null,
      pinned: false,
      cover_image: null,
      images: null,
    });
  });

  it('admin_posts 없는 제한 관리자는 다른 회원의 수정 화면을 받지 않는다', async () => {
    renderPage();

    expect(await screen.findByText('수정 권한이 없습니다.')).toBeInTheDocument();
    expect(screen.queryByTestId('post-form')).not.toBeInTheDocument();
  });

  it('admin_posts가 있으면 관리자 수정 화면을 연다', async () => {
    mocks.auth = {
      status: 'authorized',
      data: { id: 1, roles: ['member', 'admin', 'admin_posts'] },
    };

    renderPage();

    expect(await screen.findByTestId('post-form')).toHaveAttribute(
      'data-hide-admin-options',
      'false',
    );
  });
});
