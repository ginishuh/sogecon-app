import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { vi } from 'vitest';

import { CommentsSection } from '../components/comments-section';

// 서비스 mock
const listCommentsMock = vi.fn();
const createCommentMock = vi.fn();
const deleteCommentMock = vi.fn();

vi.mock('../services/comments', () => ({
  listComments: (...args: unknown[]) => listCommentsMock(...args),
  createComment: (...args: unknown[]) => createCommentMock(...args),
  deleteComment: (...args: unknown[]) => deleteCommentMock(...args),
}));

// toast mock
const showToastMock = vi.fn();
vi.mock('../components/toast', () => ({
  useToast: () => ({ show: showToastMock }),
}));

// ConfirmDialog mock — jsdom이 <dialog> API를 미지원하므로 단순 div로 대체
vi.mock('../components/confirm-dialog', () => ({
  ConfirmDialog: ({
    open,
    title,
    onConfirm,
    onCancel,
  }: {
    open: boolean;
    title: string;
    onConfirm: () => void;
    onCancel: () => void;
  }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <span>{title}</span>
        <button onClick={onConfirm}>확인</button>
        <button onClick={onCancel}>취소</button>
      </div>
    ) : null,
}));

// useAuth mock — 테스트별로 다른 세션 주입
const authDataRef: { current: ReturnType<typeof makeSession> | null } = { current: null };

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ data: authDataRef.current }),
}));

function makeSession(overrides: { id?: number; roles?: string[] } = {}) {
  return {
    id: overrides.id ?? 1,
    student_id: 's00001',
    email: 'user@example.com',
    roles: overrides.roles ?? ['member'],
  };
}

const SAMPLE_COMMENTS = [
  {
    id: 10,
    post_id: 1,
    author_id: 1,
    author_name: '홍길동',
    content: '첫 번째 댓글',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 20,
    post_id: 1,
    author_id: 99,
    author_name: '타인',
    content: '타인의 댓글',
    created_at: '2026-01-01T01:00:00Z',
  },
];

function renderComments() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CommentsSection postId={1} />
    </QueryClientProvider>,
  );
}

describe('CommentsSection — 삭제 버튼 권한', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listCommentsMock.mockResolvedValue(SAMPLE_COMMENTS);
    deleteCommentMock.mockResolvedValue(undefined);
  });

  it('비로그인: 모든 댓글에 삭제 버튼이 없음', async () => {
    authDataRef.current = null;
    renderComments();

    await waitFor(() => {
      expect(screen.getByText('첫 번째 댓글')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument();
  });

  it('작성자: 본인 댓글(author_id=1)에만 삭제 버튼 노출', async () => {
    authDataRef.current = makeSession({ id: 1 });
    renderComments();

    await waitFor(() => {
      expect(screen.getByText('첫 번째 댓글')).toBeInTheDocument();
    });
    expect(screen.getAllByRole('button', { name: '삭제' })).toHaveLength(1);
  });

  it('타인(id=2): 본인 댓글 없으면 삭제 버튼 없음', async () => {
    authDataRef.current = makeSession({ id: 2 });
    renderComments();

    await waitFor(() => {
      expect(screen.getByText('첫 번째 댓글')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument();
  });

  it('관리자: 모든 댓글에 삭제 버튼 노출', async () => {
    authDataRef.current = makeSession({ id: 999, roles: ['admin'] });
    renderComments();

    await waitFor(() => {
      expect(screen.getByText('첫 번째 댓글')).toBeInTheDocument();
    });
    expect(screen.getAllByRole('button', { name: '삭제' })).toHaveLength(2);
  });
});

describe('CommentsSection — 삭제 다이얼로그 흐름', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listCommentsMock.mockResolvedValue(SAMPLE_COMMENTS);
    deleteCommentMock.mockResolvedValue(undefined);
    authDataRef.current = makeSession({ id: 1 });
  });

  it('삭제 버튼 클릭 시 ConfirmDialog가 열림', async () => {
    renderComments();

    await waitFor(() => {
      expect(screen.getByText('첫 번째 댓글')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '삭제' }));

    expect(screen.getByRole('dialog', { name: '댓글 삭제' })).toBeInTheDocument();
  });

  it('다이얼로그 취소 시 deleteComment가 호출되지 않음', async () => {
    renderComments();

    await waitFor(() => {
      expect(screen.getByText('첫 번째 댓글')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    fireEvent.click(screen.getByRole('button', { name: '취소' }));

    expect(deleteCommentMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('다이얼로그 확인 시 deleteComment(commentId) 호출', async () => {
    renderComments();

    await waitFor(() => {
      expect(screen.getByText('첫 번째 댓글')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    fireEvent.click(screen.getByRole('button', { name: '확인' }));

    await waitFor(() => {
      expect(deleteCommentMock).toHaveBeenCalledWith(10);
    });
  });
});

describe('CommentsSection — 댓글 작성 UX', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listCommentsMock.mockResolvedValue([]);
    createCommentMock.mockResolvedValue({
      id: 100,
      post_id: 1,
      author_id: 1,
      content: '새 댓글',
      created_at: '2026-01-02T00:00:00Z',
    });
    authDataRef.current = makeSession({ id: 1 });
  });

  it('빈 댓글 제출 시 toast 에러 표시 (alert 미사용)', async () => {
    renderComments();

    await waitFor(() => expect(listCommentsMock).toHaveBeenCalled());

    // 버튼이 disabled이므로 form을 직접 submit하여 핸들러 호출
    const form = screen.getByRole('button', { name: '댓글 작성' }).closest('form');
    if (!form) throw new Error('form not found');
    fireEvent.submit(form);

    expect(showToastMock).toHaveBeenCalledWith(
      '댓글 내용을 입력해주세요.',
      expect.objectContaining({ type: 'error' }),
    );
    expect(createCommentMock).not.toHaveBeenCalled();
  });

  it('작성 성공 시 textarea가 초기화됨', async () => {
    renderComments();

    await waitFor(() => expect(listCommentsMock).toHaveBeenCalled());

    const textarea = screen.getByPlaceholderText('댓글을 입력하세요...');
    fireEvent.change(textarea, { target: { value: '새 댓글' } });
    fireEvent.click(screen.getByRole('button', { name: '댓글 작성' }));

    await waitFor(() => {
      expect(createCommentMock).toHaveBeenCalledWith(
        expect.objectContaining({ post_id: 1, content: '새 댓글' }),
      );
    });
    await waitFor(() => {
      expect((textarea as HTMLTextAreaElement).value).toBe('');
    });
  });
});
