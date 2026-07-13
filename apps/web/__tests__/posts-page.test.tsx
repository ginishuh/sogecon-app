import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { vi } from 'vitest';

import PostNotFound from '../app/posts/[id]/not-found';
import PostsPage from '../app/posts/page';

const listPostsMock = vi.fn();

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ status: 'guest', data: null }) }));
vi.mock('../services/posts', () => ({
  listPosts: (...args: unknown[]) => listPostsMock(...args),
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PostsPage />
    </QueryClientProvider>,
  );
}

describe('공지와 동문 소식 목록', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listPostsMock.mockResolvedValue([]);
  });

  it('현재 분류를 접근성 API에 노출하고 선택을 갱신한다', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: '공지사항과 반가운 소식' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '전체' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '공지사항' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: '공지사항' }));

    expect(await screen.findByText('현재 확인할 공지사항이 없습니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '전체' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '공지사항' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('존재하지 않는 공지와 동문 소식', () => {
  it('한국어 안내와 목록 복귀 행동을 제공한다', () => {
    render(<PostNotFound />);

    expect(screen.getByRole('heading', { name: '소식을 찾지 못했습니다.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '공지와 소식으로' })).toHaveAttribute('href', '/posts');
    expect(screen.queryByText('This page could not be found.')).not.toBeInTheDocument();
  });
});
