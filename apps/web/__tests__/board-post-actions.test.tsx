import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BoardPostActions } from '../components/board-post-actions';

const mocks = vi.hoisted(() => ({
  auth: {
    data: { id: 1, roles: ['member', 'admin', 'admin_posts'] },
  },
  deletePost: vi.fn(),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('../services/posts', () => ({
  deletePost: (...args: unknown[]) => mocks.deletePost(...args),
}));

vi.mock('../components/toast', () => ({
  useToast: () => ({ show: vi.fn() }),
}));

vi.mock('../components/confirm-dialog', () => ({
  ConfirmDialog: ({ open }: { open: boolean }) => (open ? <div role="dialog" /> : null),
}));

function renderActions() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BoardPostActions postId={42} postTitle="게시판 글" authorId={99} />
    </QueryClientProvider>,
  );
}

describe('게시판 게시글 관리자 액션 권한', () => {
  beforeEach(() => {
    mocks.auth = { data: { id: 1, roles: ['member', 'admin', 'admin_posts'] } };
    mocks.deletePost.mockReset();
  });

  it('admin_posts 권한이 있으면 다른 회원의 글에도 액션을 표시한다', () => {
    renderActions();

    expect(screen.getByRole('link', { name: '수정' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument();
  });

  it('admin_hero만 가진 제한 관리자는 다른 회원의 글 액션을 보지 않는다', () => {
    mocks.auth = { data: { id: 1, roles: ['member', 'admin', 'admin_hero'] } };

    renderActions();

    expect(screen.queryByRole('link', { name: '수정' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument();
  });
});
