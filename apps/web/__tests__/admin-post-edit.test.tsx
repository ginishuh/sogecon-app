import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminPostEditPage from '../app/admin/posts/[id]/edit/page';

const mocks = vi.hoisted(() => ({
  auth: {
    status: 'authorized' as const,
    data: { roles: ['member', 'admin', 'admin_posts'] },
  },
  getAdminPostPreview: vi.fn(),
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

vi.mock('../hooks/useHeroTargetControls', () => ({
  useHeroTargetControls: () => ({
    heroById: new Map(),
    isPending: false,
    toggleHero: vi.fn(),
    togglePinned: vi.fn(),
  }),
}));

vi.mock('../components/toast', () => ({
  useToast: () => ({ show: vi.fn() }),
}));

vi.mock('../components/post-form', () => ({
  PostForm: ({
    initialData,
    hideCategory,
    hidePublication,
    onSubmit,
  }: {
    initialData?: { title: string; content: string };
    hideCategory?: boolean;
    hidePublication?: boolean;
    onSubmit?: (data: unknown) => void;
  }) => (
    <article
      data-testid="post-form"
      data-hide-category={String(hideCategory)}
      data-hide-publication={String(hidePublication)}
    >
      <h1>{initialData?.title}</h1>
      <p>{initialData?.content}</p>
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
    </article>
  ),
}));

vi.mock('../services/posts', () => ({
  getAdminPostPreview: (...args: unknown[]) => mocks.getAdminPostPreview(...args),
  getPost: (...args: unknown[]) => mocks.getPost(...args),
  updatePost: (...args: unknown[]) => mocks.updatePost(...args),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminPostEditPage />
    </QueryClientProvider>,
  );
}

describe('관리자 게시글 수정 진입점', () => {
  beforeEach(() => {
    mocks.getAdminPostPreview.mockReset();
    mocks.getPost.mockReset();
    mocks.updatePost.mockReset();
    mocks.updatePost.mockResolvedValue({});
    mocks.getAdminPostPreview.mockResolvedValue({
      id: 42,
      title: '예약 공지',
      content: '발행 전 본문',
      category: 'notice',
      published_at: '2099-01-01T00:00:00Z',
      pinned: false,
      cover_image: null,
      images: null,
    });
  });

  it('draft·예약 게시글을 공개 상세가 아닌 관리자 preview API로 불러온다', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: '예약 공지' })).toBeInTheDocument();
    expect(screen.getByText('발행 전 본문')).toBeInTheDocument();
    expect(mocks.getAdminPostPreview).toHaveBeenCalledWith(42);
    expect(mocks.getPost).not.toHaveBeenCalled();
  });

  it('board 글은 공개 상태를 숨기고 관리자 payload에서도 공개 필드를 제외한다', async () => {
    mocks.getAdminPostPreview.mockResolvedValue({
      id: 42,
      title: 'board 글',
      content: 'board 본문',
      category: 'discussion',
      published_at: null,
      pinned: false,
      cover_image: null,
      images: null,
    });

    renderPage();

    const form = await screen.findByTestId('post-form');
    expect(form).toHaveAttribute('data-hide-category', 'true');
    expect(form).toHaveAttribute('data-hide-publication', 'true');
    screen.getByRole('button', { name: '제출' }).click();

    await waitFor(() => expect(mocks.updatePost).toHaveBeenCalledTimes(1));
    const payload = mocks.updatePost.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('category');
    expect(payload).not.toHaveProperty('published_at');
    expect(payload).not.toHaveProperty('unpublish');
    expect(payload.pinned).toBe(true);
  });
});
