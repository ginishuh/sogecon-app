import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { vi } from 'vitest';

import BoardPage from '../app/board/page';
import BoardNewPage from '../app/board/new/page';

const listPostsMock = vi.fn();
const createPostMock = vi.fn();

vi.mock('../services/posts', () => ({
  listPosts: (...args: unknown[]) => listPostsMock(...(args as Parameters<typeof listPostsMock>)),
  getPost: vi.fn(),
  createPost: (...args: unknown[]) => createPostMock(...(args as Parameters<typeof createPostMock>)),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    data: { kind: 'member', email: 'user@example.com' as const },
    status: 'authorized' as const,
  }),
}));

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

function renderWithClient(element: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
}

describe('BoardPage', () => {
  beforeEach(() => {
    pushMock.mockReset();
    listPostsMock.mockReset();
    createPostMock.mockReset();
  });

  it('목록을 렌더링하고 검색으로 필터링한다', async () => {
    listPostsMock.mockResolvedValueOnce([
      { id: 1, title: '첫 번째 글', content: '커뮤니티 환영', published_at: null, author_id: 1, category: 'discussion' },
      { id: 2, title: 'Q&A', content: '질문 있어요', published_at: null, author_id: 2, category: 'question' },
    ]);

    renderWithClient(<BoardPage />);

    await waitFor(() => {
      expect(screen.getByText('첫 번째 글')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('제목 또는 내용');
    fireEvent.change(searchInput, { target: { value: 'Q&A' } });

    expect(screen.queryByText('첫 번째 글')).not.toBeInTheDocument();
    expect(screen.getByText('Q&A')).toBeInTheDocument();
  });

  it('카테고리 탭 전환 시 새 데이터를 불러온다', async () => {
    listPostsMock.mockImplementation((params?: { category?: string }) => {
      if (!params || !params.category) {
        return Promise.resolve([
          { id: 10, title: '자유 게시글', content: '자유롭게', published_at: null, author_id: 1, category: 'discussion' },
        ]);
      }
      if (params.category === 'question') {
        return Promise.resolve([
          { id: 20, title: '질문 게시글', content: '무엇이든 물어보세요', published_at: null, author_id: 2, category: 'question' },
        ]);
      }
      return Promise.resolve([]);
    });

    renderWithClient(<BoardPage />);

    await waitFor(() => {
      expect(screen.getByText('자유 게시글')).toBeInTheDocument();
    });

    const questionTab = screen.getByRole('tab', { name: '질문' });
    fireEvent.click(questionTab);

    await waitFor(() => {
      expect(screen.getByText('질문 게시글')).toBeInTheDocument();
    });
    expect(listPostsMock).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'question' }));
  });
});

describe('BoardNewPage', () => {
  beforeEach(() => {
    pushMock.mockReset();
    createPostMock.mockReset();
    createPostMock.mockResolvedValue({ id: 99 });
  });

  it('폼 제출 시 게시글 생성 API를 호출한다', async () => {
    renderWithClient(<BoardNewPage />);

    fireEvent.change(screen.getByPlaceholderText('글 제목을 입력하세요'), { target: { value: '새 글' } });
    fireEvent.change(screen.getByLabelText('카테고리'), { target: { value: 'question' } });
    fireEvent.change(screen.getByPlaceholderText('커뮤니티 글 내용을 입력하세요'), { target: { value: '본문 내용' } });

    fireEvent.click(screen.getByRole('button', { name: '작성' }));

    await waitFor(() => {
      expect(createPostMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '새 글',
          content: '본문 내용',
          category: 'question',
        }),
      );
    });
    const callArgs = createPostMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(callArgs).not.toHaveProperty('author_id');
    expect(pushMock).toHaveBeenCalledWith('/board');
  });

  it('에러 시 안내 메시지를 표시하고 제출 버튼 상태를 업데이트한다', async () => {
    const { ApiError } = await import('../lib/api');
    // 지연 promise로 pending 상태 확인 → 이후 즉시 오류로 전환
    let rejectFn: (e: unknown) => void;
    createPostMock.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectFn = reject;
        }),
    );

    renderWithClient(<BoardNewPage />);

    fireEvent.change(screen.getByPlaceholderText('글 제목을 입력하세요'), { target: { value: '제목' } });
    fireEvent.change(screen.getByLabelText('카테고리'), { target: { value: 'discussion' } });
    fireEvent.change(screen.getByPlaceholderText('커뮤니티 글 내용을 입력하세요'), { target: { value: '본문' } });

    const submit = screen.getByRole('button', { name: '작성' });
    fireEvent.click(submit);
    // pending 텍스트 — 비동기 상태 반영 대기
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '작성 중…' })).toBeDisabled();
    });

    // 오류 전환
    rejectFn?.(new ApiError(401, 'Unauthorized'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('로그인 후 다시 시도해주세요.');
    });
  });
});
