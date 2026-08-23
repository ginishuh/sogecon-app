import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminSignupRequestsPage from '../app/admin/signup-requests/page';
import { ToastProvider } from '../components/toast';
import type { SignupActivationIssueResponse, SignupRequestRead } from '../services/signup-requests';

const mocks = vi.hoisted(() => ({
  auth: {
    status: 'authorized' as const,
    data: { roles: ['member', 'admin', 'admin_signup'] },
  },
  listAdminSignupRequests: vi.fn(),
  approveAdminSignupRequest: vi.fn(),
  listAdminSignupRequestActivationTokenLogs: vi.fn(),
  sendAdminSignupActivationEmail: vi.fn(),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('../services/signup-requests', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services/signup-requests')>();
  return {
    ...original,
    listAdminSignupRequests: mocks.listAdminSignupRequests,
    approveAdminSignupRequest: mocks.approveAdminSignupRequest,
    listAdminSignupRequestActivationTokenLogs: mocks.listAdminSignupRequestActivationTokenLogs,
    sendAdminSignupActivationEmail: mocks.sendAdminSignupActivationEmail,
  };
});

const request: SignupRequestRead = {
  id: 17,
  student_id: 'e2e-signup',
  email: 'e2e-signup@example.com',
  name: '합성 가입신청',
  cohort: 177,
  major: '경제',
  phone: '01000000000',
  note: null,
  status: 'pending',
  requested_at: '2026-07-14T00:00:00Z',
  decided_at: null,
  activated_at: null,
  decided_by_student_id: null,
  reject_reason: null,
};

const approveResponse: SignupActivationIssueResponse = {
  request: { ...request, status: 'approved' },
  activation_context: {
    signup_request_id: 17,
    student_id: 'e2e-signup',
    email: 'e2e-signup@example.com',
    name: '합성 가입신청',
    cohort: 177,
  },
  activation_token: 'mock-activation-token',
  activation_issue: {
    id: 1,
    signup_request_id: 17,
    issued_type: 'approve',
    issued_by_student_id: 'admin01',
    token_tail: 'token',
    issued_at: '2026-08-13T01:00:00Z',
  },
};

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

describe('가입신청 활성화 토큰 로그 실패 피드백', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.status = 'authorized';
    mocks.auth.data = { roles: ['member', 'admin', 'admin_signup'] };
    mocks.listAdminSignupRequests.mockResolvedValue({ items: [request], total: 1 });
    mocks.approveAdminSignupRequest.mockResolvedValue(approveResponse);
    mocks.listAdminSignupRequestActivationTokenLogs.mockRejectedValue(new Error('network'));
    mocks.sendAdminSignupActivationEmail.mockResolvedValue({
      sent_to: 'e2e-signup@example.com',
    });
  });

  it('토큰 로그 조회 실패를 화면 피드백과 toast로 알린다', async () => {
    render(<AdminSignupRequestsPage />, { wrapper: Providers });

    fireEvent.click((await screen.findAllByRole('button', { name: '승인' }))[0]);

    const message = '활성화 안내 기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getAllByText(message).length).toBeGreaterThanOrEqual(2);
  });
});

describe('가입신청 안내 메일 발송', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.status = 'authorized';
    mocks.auth.data = { roles: ['member', 'admin', 'admin_signup'] };
    mocks.listAdminSignupRequests.mockResolvedValue({ items: [request], total: 1 });
    mocks.approveAdminSignupRequest.mockResolvedValue(approveResponse);
    mocks.listAdminSignupRequestActivationTokenLogs.mockResolvedValue({
      items: [approveResponse.activation_issue],
    });
    mocks.sendAdminSignupActivationEmail.mockResolvedValue({
      sent_to: 'e2e-signup@example.com',
    });
  });

  it('승인 후 신청자 이메일로 안내 메일을 보낸다', async () => {
    render(<AdminSignupRequestsPage />, { wrapper: Providers });

    fireEvent.click((await screen.findAllByRole('button', { name: '승인' }))[0]);
    fireEvent.click(await screen.findByRole('button', { name: '안내 메일 보내기' }));

    await waitFor(() => {
      expect(mocks.sendAdminSignupActivationEmail).toHaveBeenCalledWith(
        17,
        'mock-activation-token',
      );
    });
    expect(
      await screen.findAllByText('e2e-signup@example.com으로 안내 메일을 보냈습니다.'),
    ).not.toHaveLength(0);
  });
});
