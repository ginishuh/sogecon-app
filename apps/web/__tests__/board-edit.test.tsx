import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import BoardEditPage from '../app/board/[id]/edit/page';
import { adminPostKeys, postKeys } from '../lib/query-keys';

const mocks = vi.hoisted(() => ({
  auth: {
    status: 'authorized' as const,
    data: { id: 1, roles: ['member', 'admin', 'admin_hero'] },
  },
  getPost: vi.fn(),
  updatePost: vi.fn(),
  updateBoardPost: vi.fn(),
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
  updateBoardPost: (...args: unknown[]) => mocks.updateBoardPost(...args),
}));

vi.mock('../components/post-form', () => ({
  PostForm: ({
    hideAdminOptions,
    onSubmit,
  }: {
    hideAdminOptions?: boolean;
    onSubmit?: (data: unknown) => void;
  }) => (
    <div data-testid="post-form" data-hide-admin-options={String(hideAdminOptions)}>
      <button
        type="button"
        onClick={() => onSubmit?.({
          title: '수정 제목',
          content: '수정 본문',
          category: 'notice',
          pinned: true,
          cover_image: null,
          images: [],
          published: true,
        })}
      >
        제출
      </button>
    </div>
  ),
}));

function renderPage(queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
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
    mocks.updateBoardPost.mockReset();
    mocks.updatePost.mockResolvedValue({});
    mocks.updateBoardPost.mockResolvedValue({});
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

  it('일반 작성자는 board 글을 owner endpoint로 수정하고 관리자 옵션을 보지 않는다', async () => {
    mocks.auth = {
      status: 'authorized',
      data: { id: 99, roles: ['member'] },
    };
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

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    renderPage(queryClient);

    expect(await screen.findByTestId('post-form')).toHaveAttribute(
      'data-hide-admin-options',
      'true',
    );
    screen.getByRole('button', { name: '제출' }).click();

    await waitFor(() => {
      expect(mocks.updateBoardPost).toHaveBeenCalledWith(42, {
        title: '수정 제목',
        content: '수정 본문',
        cover_image: null,
        images: [],
      });
    });
    expect(mocks.updatePost).not.toHaveBeenCalled();
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: postKeys.all });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: adminPostKeys.all });
  });

  it('일반 작성자는 non-board 글의 수정 화면을 받지 않는다', async () => {
    mocks.auth = {
      status: 'authorized',
      data: { id: 99, roles: ['member'] },
    };
    mocks.getPost.mockResolvedValue({
      id: 42,
      title: '공지',
      content: '본문',
      category: 'notice',
      author_id: 99,
      published_at: null,
      pinned: false,
      cover_image: null,
      images: null,
    });

    renderPage();

    expect(await screen.findByText('수정 권한이 없습니다.')).toBeInTheDocument();
    expect(screen.queryByTestId('post-form')).not.toBeInTheDocument();
  });
});
