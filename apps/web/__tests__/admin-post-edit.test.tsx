import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
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
  }: {
    initialData?: { title: string; content: string };
  }) => (
    <article>
      <h1>{initialData?.title}</h1>
      <p>{initialData?.content}</p>
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
});
