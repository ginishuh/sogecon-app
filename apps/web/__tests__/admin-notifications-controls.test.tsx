import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminNotificationsPage, {
  LogsBlock,
  PrunePanel,
  StatsBlock,
} from '../app/admin/notifications/page';
import { getNotificationStats, getSendLogs } from '../services/notifications';

const mocks = vi.hoisted(() => ({
  auth: {
    status: 'loading' as 'loading' | 'authorized',
    data: undefined as
      | undefined
      | {
          kind: 'admin';
          student_id: string;
          email: string;
          name: string;
          roles: string[];
        },
  },
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('../components/toast', () => ({
  useToast: () => ({ show: vi.fn() }),
}));

vi.mock('../services/notifications', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services/notifications')>();
  return {
    ...original,
    getNotificationStats: vi.fn(),
    getSendLogs: vi.fn(),
    pruneSendLogs: vi.fn(),
    sendNotification: vi.fn(),
  };
});

function QueryProvider({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('알림 관리자 인증과 권한 경계', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.status = 'loading';
    mocks.auth.data = undefined;
  });

  it('인증 확인 중에는 비로그인 문구 대신 확인 중 문구를 표시한다', () => {
    render(<AdminNotificationsPage />, { wrapper: QueryProvider });

    expect(screen.getByText('관리자 권한을 확인하고 있습니다.')).toBeInTheDocument();
    expect(screen.queryByText('관리자 로그인이 필요합니다.')).not.toBeInTheDocument();
    expect(getNotificationStats).not.toHaveBeenCalled();
    expect(getSendLogs).not.toHaveBeenCalled();
  });

  it('admin_notifications 권한이 없으면 통계와 로그 API를 요청하지 않는다', () => {
    mocks.auth.status = 'authorized';
    mocks.auth.data = {
      kind: 'admin',
      student_id: 'e2e',
      email: 'e2e@example.com',
      name: '제한 관리자',
      roles: ['member', 'admin', 'admin_posts'],
    };

    render(<AdminNotificationsPage />, { wrapper: QueryProvider });

    expect(screen.getByText('해당 화면 접근 권한이 없습니다.')).toBeInTheDocument();
    expect(getNotificationStats).not.toHaveBeenCalled();
    expect(getSendLogs).not.toHaveBeenCalled();
  });
});

describe('알림 관리자 조작 접근성', () => {
  it('통계 기간과 새로고침 조작에 visible label과 44px focus 계약을 둔다', () => {
    render(
      <StatsBlock
        data={undefined}
        isLoading={false}
        isError={false}
        statsRange="7d"
        setStatsRange={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    const range = screen.getByLabelText('기간');
    expect(range).toHaveClass('min-h-11');
    expect(range).toHaveClass('focus-visible:ring-2');
    const refresh = screen.getByRole('button', { name: '요약 새로고침' });
    expect(refresh).toHaveClass('min-h-11');
    expect(refresh).toHaveClass('focus-visible:ring-2');
  });

  it('로그 정리 조작을 44px로 제공한다', () => {
    render(
      <PrunePanel
        pruneDays={30}
        setPruneDays={vi.fn()}
        busy={false}
        onPrune={vi.fn()}
      />,
    );

    const days = screen.getByLabelText('보관 기간(일)');
    expect(days).toHaveClass('min-h-11');
    expect(days).toHaveClass('focus-visible:ring-2');
    const prune = screen.getByRole('button', { name: '오래된 로그 삭제' });
    expect(prune).toHaveClass('min-h-11');
    expect(prune).toHaveClass('focus-visible:ring-2');
  });

  it('로그가 없으면 한국어 빈 상태를 표시하고 표시 개수 조작을 44px로 제공한다', () => {
    render(
      <LogsBlock
        data={[]}
        isLoading={false}
        isError={false}
        logLimit={50}
        setLogLimit={vi.fn()}
      />,
    );

    expect(screen.getByText('아직 발송 로그가 없습니다.')).toBeInTheDocument();
    const limit = screen.getByLabelText('표시 개수');
    expect(limit).toHaveClass('min-h-11');
    expect(limit).toHaveClass('focus-visible:ring-2');
  });
});
