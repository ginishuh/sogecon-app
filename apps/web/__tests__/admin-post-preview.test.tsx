import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import AdminPostPreviewPage from '../app/admin/posts/[id]/preview/page';

const getAdminPostPreviewMock = vi.fn();
const authState: {
  status: 'authorized' | 'unauthorized';
  data: { roles: string[] } | null;
} = {
  status: 'authorized',
  data: { roles: ['admin_posts'] },
};

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '42' }),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('../services/posts', () => ({
  getAdminPostPreview: (...args: unknown[]) => getAdminPostPreviewMock(...args),
}));

vi.mock('../components/post-detail-content', () => ({
  PostDetailContent: ({
    post,
    showAdminActions,
  }: {
    post: { title: string; content: string };
    showAdminActions?: boolean;
  }) => (
    <article data-admin-actions={String(showAdminActions)}>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
    </article>
  ),
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminPostPreviewPage />
    </QueryClientProvider>,
  );
}

describe('관리자 게시글 draft preview', () => {
  beforeEach(() => {
    authState.status = 'authorized';
    authState.data = { roles: ['admin_posts'] };
    getAdminPostPreviewMock.mockReset();
  });

  it('권한 있는 관리자가 브라우저 API 조회 결과로 draft 본문을 확인한다', async () => {
    getAdminPostPreviewMock.mockResolvedValue({
      id: 42,
      title: '관리자 초안',
      content: '발행 전 본문',
      category: 'notice',
      published_at: null,
    });

    renderPage();

    expect(await screen.findByRole('heading', { name: '관리자 초안' })).toBeInTheDocument();
    expect(screen.getByText('발행 전 본문')).toBeInTheDocument();
    expect(getAdminPostPreviewMock).toHaveBeenCalledWith(42);
    expect(screen.getByRole('article')).toHaveAttribute('data-admin-actions', 'true');
  });

  it('admin_hero만 가진 관리자는 본문만 보고 수정·삭제 액션은 보지 않는다', async () => {
    authState.data = { roles: ['member', 'admin', 'admin_hero'] };
    getAdminPostPreviewMock.mockResolvedValue({
      id: 42,
      title: 'hero 초안',
      content: 'hero 읽기 전용 본문',
      category: 'news',
      published_at: null,
    });

    renderPage();

    expect(await screen.findByRole('heading', { name: 'hero 초안' })).toBeInTheDocument();
    expect(screen.getByRole('article')).toHaveAttribute('data-admin-actions', 'false');
    expect(getAdminPostPreviewMock).toHaveBeenCalledWith(42);
  });

  it('게시물 관리·hero 권한이 없으면 preview 본문을 조회하지 않는다', () => {
    authState.data = { roles: ['member'] };

    renderPage();

    expect(screen.getByText('해당 화면 접근 권한이 없습니다.')).toBeInTheDocument();
    expect(getAdminPostPreviewMock).not.toHaveBeenCalled();
  });

  it('인증되지 않은 사용자는 관리자 인증 안내를 본다', () => {
    authState.status = 'unauthorized';
    authState.data = null;

    render(<AdminPostPreviewPage />);

    expect(screen.getByText('관리자 로그인이 필요합니다.')).toBeInTheDocument();
    expect(getAdminPostPreviewMock).not.toHaveBeenCalled();
  });
});
