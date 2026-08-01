import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PostAdminActions } from '../components/post-admin-actions';

const mocks = vi.hoisted(() => ({
  auth: {
    status: 'authorized' as const,
    data: { roles: ['member', 'admin', 'admin_posts'] },
  },
  deletePost: vi.fn(),
  push: vi.fn(),
  show: vi.fn(),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('../services/posts', () => ({
  deletePost: (...args: unknown[]) => mocks.deletePost(...args),
}));

vi.mock('../components/toast', () => ({
  useToast: () => ({ show: mocks.show }),
}));

vi.mock('../components/confirm-dialog', () => ({
  ConfirmDialog: ({ open }: { open: boolean }) => (open ? <div role="dialog" /> : null),
}));

function renderActions() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <PostAdminActions postId={42} postTitle="게시물" />
    </QueryClientProvider>,
  );
}

describe('게시글 관리자 액션 권한', () => {
  beforeEach(() => {
    mocks.auth = {
      status: 'authorized',
      data: { roles: ['member', 'admin', 'admin_posts'] },
    };
    mocks.deletePost.mockReset();
    mocks.push.mockReset();
    mocks.show.mockReset();
  });

  it('admin_posts 권한이 있으면 수정·삭제 액션을 표시한다', () => {
    renderActions();

    expect(screen.getByRole('link', { name: '수정' })).toHaveAttribute(
      'href',
      '/admin/posts/42/edit',
    );
    expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument();
  });

  it('admin_hero만 가진 제한 관리자는 게시글 수정·삭제 액션을 보지 않는다', () => {
    mocks.auth = {
      status: 'authorized',
      data: { roles: ['member', 'admin', 'admin_hero'] },
    };

    renderActions();

    expect(screen.queryByRole('link', { name: '수정' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument();
  });
});
