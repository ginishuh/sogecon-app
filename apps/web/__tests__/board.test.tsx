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

const authStatusRef: { current: 'authorized' | 'unauthorized' | 'loading' } = { current: 'authorized' };

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    data: authStatusRef.current === 'authorized' ? { kind: 'member' as const, email: 'user@example.com', student_id: '20250001' } : null,
    status: authStatusRef.current,
  }),
}));

let currentSearchParams = new URLSearchParams();
const pushMock = vi.fn((url: string) => {
  const query = url.split('?')[1] ?? '';
  currentSearchParams = new URLSearchParams(query);
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => currentSearchParams,
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
    currentSearchParams = new URLSearchParams();
    authStatusRef.current = 'authorized';
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

    const searchInput = screen.getByRole('textbox', { name: '게시글 검색' });
    fireEvent.change(searchInput, { target: { value: 'Q&A' } });

    expect(screen.queryByText('첫 번째 글')).not.toBeInTheDocument();
    expect(screen.getByText('Q&A')).toBeInTheDocument();
  });

  it('카테고리 탭 전환 시 새 데이터를 불러온다', async () => {
    listPostsMock.mockImplementation((params?: { category?: string; categories?: string[] }) => {
      if (!params || (params.categories && params.categories.length > 0)) {
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
    expect(listPostsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        categories: ['discussion', 'question', 'share', 'congrats'],
      }),
    );

    const questionTab = screen.getByRole('tab', { name: '묻고 답하기' });
    fireEvent.click(questionTab);

    await waitFor(() => {
      expect(screen.getByText('질문 게시글')).toBeInTheDocument();
    });
    expect(listPostsMock).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'question' }));
  });

  it('이미지가 있는 고정 글 한 건을 주요 이야기와 목록에 함께 유지한다', async () => {
    listPostsMock.mockResolvedValueOnce([
      {
        id: 30,
        title: '동문 주요 이야기',
        content: '동문들의 새로운 도전을 소개합니다.',
        published_at: '2026-07-13T00:00:00+09:00',
        author_id: 1,
        author_name: '서강 동문',
        category: 'discussion',
        pinned: true,
        cover_image: '/media/images/featured.png',
      },
    ]);

    renderWithClient(<BoardPage />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: '주요 이야기: 동문 주요 이야기' })).toBeInTheDocument();
    });
    expect(screen.getAllByText('동문 주요 이야기')).toHaveLength(2);
    expect(screen.queryByText('아직 등록된 게시글이 없습니다.')).not.toBeInTheDocument();
  });

  it('고정 글이어도 이미지가 없으면 주요 이야기로 승격하지 않는다', async () => {
    listPostsMock.mockResolvedValueOnce([
      {
        id: 31,
        title: '이미지 없는 고정 글',
        content: '목록에서만 보여야 합니다.',
        published_at: null,
        author_id: 1,
        category: 'discussion',
        pinned: true,
      },
    ]);

    renderWithClient(<BoardPage />);

    await waitFor(() => {
      expect(screen.getByText('이미지 없는 고정 글')).toBeInTheDocument();
    });
    expect(screen.queryByRole('link', { name: /주요 이야기:/ })).not.toBeInTheDocument();
  });

  it('목록에서 작성 시각과 레거시 날짜 fallback을 표시한다', async () => {
    listPostsMock.mockResolvedValueOnce([
      {
        id: 32,
        title: '작성 시각이 있는 글',
        content: '본문',
        published_at: null,
        created_at: '2026-07-13T12:00:00+09:00',
        author_id: 1,
        category: 'discussion',
      },
      {
        id: 33,
        title: '작성 시각이 없는 기존 글',
        content: '본문',
        published_at: null,
        created_at: null,
        author_id: 1,
        category: 'discussion',
      },
    ]);

    renderWithClient(<BoardPage />);

    expect(await screen.findByText('작성 시각이 있는 글')).toBeInTheDocument();
    expect(screen.getByText('07/13')).toBeInTheDocument();
    expect(screen.getByText('작성일 미확인')).toBeInTheDocument();
  });

  it('게시글이 0건이면 첫 글 행동이 있는 빈 상태를 표시한다', async () => {
    listPostsMock.mockResolvedValueOnce([]);

    renderWithClient(<BoardPage />);

    expect(await screen.findByText('아직 등록된 게시글이 없습니다.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '첫 글 남기기' })).toHaveAttribute('href', '/board/new');
  });

  it('다음 페이지를 불러와도 앞선 게시글을 유지한다', async () => {
    const firstPage = Array.from({ length: 10 }, (_, index) => ({
      id: index + 1,
      title: `게시글 ${index + 1}`,
      content: '본문',
      published_at: null,
      created_at: `2026-07-${String(12 - index).padStart(2, '0')}T00:00:00+09:00`,
      author_id: 1,
      category: 'discussion',
    }));
    listPostsMock
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([
        {
          id: 11,
          title: '게시글 11',
          content: '본문',
          published_at: null,
          created_at: '2026-07-01T00:00:00+09:00',
          author_id: 1,
          category: 'discussion',
        },
      ]);

    renderWithClient(<BoardPage />);

    expect(await screen.findByText('게시글 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '더 불러오기' }));

    expect(await screen.findByText('게시글 11')).toBeInTheDocument();
    expect(screen.getByText('게시글 1')).toBeInTheDocument();
    expect(listPostsMock).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 10 }));
    expect(screen.getByRole('button', { name: '더 불러오기' })).toBeDisabled();
  });

  it('검색 초기화와 활성 더 불러오기에 공통 키보드 포커스 링 계약을 적용한다', async () => {
    listPostsMock.mockResolvedValueOnce(Array.from({ length: 10 }, (_, index) => ({
      id: index + 1,
      title: `포커스 게시글 ${index + 1}`,
      content: '본문',
      published_at: null,
      created_at: `2026-07-${String(13 - index).padStart(2, '0')}T00:00:00+09:00`,
      author_id: 1,
      category: 'discussion',
    })));

    renderWithClient(<BoardPage />);

    expect(await screen.findByText('포커스 게시글 1')).toBeInTheDocument();
    for (const button of [
      screen.getByRole('button', { name: '초기화' }),
      screen.getByRole('button', { name: '더 불러오기' }),
    ]) {
      expect(button).toHaveClass(
        'focus-visible:outline-hidden',
        'focus-visible:ring-2',
        'focus-visible:ring-brand-400',
        'focus-visible:ring-offset-2',
        'focus-visible:ring-offset-surface',
      );
    }
  });
});

describe('BoardNewPage', () => {
  beforeEach(() => {
    pushMock.mockReset();
    createPostMock.mockReset();
    createPostMock.mockResolvedValue({ id: 99 });
    authStatusRef.current = 'authorized';
  });

  it('비회원에게 제출 폼 대신 로그인 복구 행동을 제공한다', () => {
    authStatusRef.current = 'unauthorized';
    renderWithClient(<BoardNewPage />);

    expect(screen.getByRole('heading', { name: '로그인 후 이야기를 남길 수 있어요' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '동문 로그인' })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button', { name: '게시글 등록하기' })).not.toBeInTheDocument();
  });

  it('폼 제출 시 게시글 생성 API를 호출한다', async () => {
    renderWithClient(<BoardNewPage />);

    fireEvent.change(screen.getByRole('textbox', { name: /^제목/ }), { target: { value: '새 글' } });
    fireEvent.change(screen.getByLabelText('글 종류'), { target: { value: 'question' } });
    fireEvent.change(screen.getByRole('textbox', { name: /^내용/ }), { target: { value: '본문 내용' } });

    fireEvent.click(screen.getByRole('button', { name: '게시글 등록하기' }));

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

    fireEvent.change(screen.getByRole('textbox', { name: /^제목/ }), { target: { value: '제목' } });
    fireEvent.change(screen.getByLabelText('글 종류'), { target: { value: 'discussion' } });
    fireEvent.change(screen.getByRole('textbox', { name: /^내용/ }), { target: { value: '본문' } });

    const submit = screen.getByRole('button', { name: '게시글 등록하기' });
    fireEvent.click(submit);
    // pending 텍스트 — 비동기 상태 반영 대기
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '등록하는 중…' })).toBeDisabled();
    });

    // 오류 전환
    rejectFn?.(new ApiError(401, 'Unauthorized'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('로그인 후 다시 시도해주세요.');
    });
  });
});
