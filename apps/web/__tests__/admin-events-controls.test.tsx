import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import AdminEventsPage, {
  EventTable,
  FiltersBar,
  Pagination,
} from '../app/admin/events/page';
import { EventForm } from '../app/admin/events/[id]/edit/page';
import type { AdminEventListResponse } from '../services/events';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ status: 'loading', data: undefined }),
}));

vi.mock('../components/toast', () => ({
  useToast: () => ({ show: vi.fn() }),
}));

function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      {children}
    </QueryClientProvider>
  );
}

const event = {
  id: 10,
  title: '합성 행사',
  description: '합성 행사 설명',
  starts_at: '2026-07-25T01:00:00Z',
  ends_at: '2026-07-25T03:00:00Z',
  location: '합성 행사장',
  capacity: 20,
  rsvp_counts: { going: 0, waitlist: 0, cancel: 0 },
} satisfies AdminEventListResponse['items'][number];

describe('행사 관리자 인증 상태', () => {
  it('인증 확인 중에는 비로그인 문구 대신 확인 중 문구를 표시한다', () => {
    render(<AdminEventsPage />, { wrapper: QueryProvider });

    expect(screen.getByText('관리자 권한을 확인하고 있습니다.')).toBeInTheDocument();
    expect(screen.queryByText('관리자 로그인이 필요합니다.')).not.toBeInTheDocument();
  });
});

describe('행사 관리자 목록 조작 접근성', () => {
  it('필터를 visible label에 연결하고 모든 조작에 44px focus 계약을 둔다', () => {
    render(
      <FiltersBar
        query=""
        status="all"
        dateFrom=""
        dateTo=""
        onChangeQuery={vi.fn()}
        onChangeStatus={vi.fn()}
        onChangeDateFrom={vi.fn()}
        onChangeDateTo={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    for (const name of ['제목 검색', '상태', '시작일(이후)', '종료일(이전)']) {
      const control = screen.getByLabelText(name);
      expect(control).toHaveClass('min-h-11');
      expect(control).toHaveClass('focus-visible:ring-2');
    }
    expect(screen.getByRole('button', { name: '초기화' })).toHaveClass('min-h-11');
  });

  it('수정·삭제와 페이지 이동 버튼에 44px focus 계약을 둔다', () => {
    const { rerender } = render(
      <EventTable
        items={[event]}
        isLoading={false}
        isError={false}
        canManageHero={false}
        heroById={new Map()}
        heroPending={false}
        onToggleHeroFor={vi.fn()}
        onTogglePinnedFor={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    for (const name of ['수정', '삭제']) {
      const control = screen.getByRole(name === '수정' ? 'link' : 'button', { name });
      expect(control).toHaveClass('min-h-11');
      expect(control).toHaveClass('focus-visible:ring-2');
    }

    rerender(
      <Pagination
        page={0}
        totalPages={1}
        total={1}
        isFetching={false}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    for (const name of ['이전', '다음']) {
      const button = screen.getByRole('button', { name });
      expect(button).toHaveClass('min-h-11');
      expect(button).toHaveClass('focus-visible:ring-2');
      expect(button).toBeDisabled();
    }
  });
});

describe('행사 수정 폼 접근성', () => {
  it('모든 필드를 visible label에 연결하고 action을 44px로 제공한다', () => {
    render(
      <EventForm
        state={{
          title: '합성 행사',
          location: '합성 행사장',
          description: '합성 설명',
          capacity: 20,
          startsAt: '2026-07-25T10:00',
          endsAt: '2026-07-25T12:00',
        }}
        disabled={false}
        saving={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onView={vi.fn()}
        onDeleteClick={vi.fn()}
      />,
    );

    for (const name of ['제목', '장소', '내용', '정원', '시작 일시', '종료 일시']) {
      const control = screen.getByLabelText(name);
      expect(control).toHaveClass('min-h-11');
      expect(control).toHaveClass('focus-visible:ring-2');
    }
    for (const name of ['수정 저장', '공개 페이지 보기', '삭제']) {
      const button = screen.getByRole('button', { name });
      expect(button).toHaveClass('min-h-11');
      expect(button).toHaveClass('focus-visible:ring-2');
    }
  });
});
