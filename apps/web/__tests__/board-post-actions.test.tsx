import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BoardPostActions } from '../components/board-post-actions';

const mocks = vi.hoisted(() => ({
  auth: {
    data: { id: 1, roles: ['member', 'admin', 'admin_posts'] },
  },
  deletePost: vi.fn(),
  deleteBoardPost: vi.fn(),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('../services/posts', () => ({
  deletePost: (...args: unknown[]) => mocks.deletePost(...args),
  deleteBoardPost: (...args: unknown[]) => mocks.deleteBoardPost(...args),
}));

vi.mock('../components/toast', () => ({
  useToast: () => ({ show: vi.fn() }),
}));

vi.mock('../components/confirm-dialog', () => ({
  ConfirmDialog: ({
    open,
    onConfirm,
  }: {
    open: boolean;
    onConfirm: () => void;
  }) => (open ? (
    <div role="dialog">
      <button type="button" onClick={onConfirm}>삭제 확인</button>
    </div>
  ) : null),
}));

function renderActions({ authorId = 99, category = 'discussion' } = {}) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BoardPostActions
        postId={42}
        postTitle="게시판 글"
        authorId={authorId}
        category={category}
      />
    </QueryClientProvider>,
  );
}

describe('게시판 게시글 관리자 액션 권한', () => {
  beforeEach(() => {
    mocks.auth = { data: { id: 1, roles: ['member', 'admin', 'admin_posts'] } };
    mocks.deletePost.mockReset();
    mocks.deleteBoardPost.mockReset();
    mocks.deletePost.mockResolvedValue({ ok: true, deleted_id: 42 });
    mocks.deleteBoardPost.mockResolvedValue({ ok: true, deleted_id: 42 });
  });

  it('admin_posts 권한이 있으면 다른 회원의 글에도 기존 관리자 endpoint 액션을 표시한다', async () => {
    renderActions();

    expect(screen.getByRole('link', { name: '수정' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '삭제 확인' }));

    await waitFor(() => expect(mocks.deletePost).toHaveBeenCalledWith(42));
    expect(mocks.deleteBoardPost).not.toHaveBeenCalled();
  });

  it('admin_hero만 가진 제한 관리자는 다른 회원의 글 액션을 보지 않는다', () => {
    mocks.auth = { data: { id: 1, roles: ['member', 'admin', 'admin_hero'] } };

    renderActions();

    expect(screen.queryByRole('link', { name: '수정' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument();
  });

  it('일반 회원은 자기 board 글의 owner endpoint 액션을 표시한다', async () => {
    mocks.auth = { data: { id: 99, roles: ['member'] } };

    renderActions({ authorId: 99 });

    expect(screen.getByRole('link', { name: '수정' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '삭제 확인' }));

    await waitFor(() => expect(mocks.deleteBoardPost).toHaveBeenCalledWith(42));
    expect(mocks.deletePost).not.toHaveBeenCalled();
  });

  it('일반 회원은 타인 글과 non-board 글의 owner 액션을 보지 않는다', () => {
    mocks.auth = { data: { id: 99, roles: ['member'] } };

    const { rerender } = renderActions({ authorId: 100 });
    expect(screen.queryByRole('link', { name: '수정' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument();

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <BoardPostActions
          postId={42}
          postTitle="공지"
          authorId={99}
          category="notice"
        />
      </QueryClientProvider>,
    );
    expect(screen.queryByRole('link', { name: '수정' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument();
  });
});
