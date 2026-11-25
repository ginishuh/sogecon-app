import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminSignupRequestsPage from '../app/admin/signup-requests/page';
import { ToastProvider } from '../components/toast';
import { ApiError } from '../lib/api';
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
  reissueAdminSignupRequestActivationToken: vi.fn(),
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
    reissueAdminSignupRequestActivationToken: mocks.reissueAdminSignupRequestActivationToken,
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
  activation_email: { status: 'sent', sent_to: 'e2e-signup@example.com', error_code: null },
};

const approveMailFailedResponse: SignupActivationIssueResponse = {
  ...approveResponse,
  activation_email: { status: 'failed', sent_to: null, error_code: 'email_not_configured' },
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
    mocks.approveAdminSignupRequest.mockResolvedValue(approveMailFailedResponse);
    mocks.listAdminSignupRequestActivationTokenLogs.mockResolvedValue({
      items: [approveResponse.activation_issue],
    });
    mocks.sendAdminSignupActivationEmail.mockResolvedValue({
      sent_to: 'e2e-signup@example.com',
    });
  });

  it('승인하면 자동 발송 결과를 알리고 다시 보내기를 제공한다', async () => {
    mocks.approveAdminSignupRequest.mockResolvedValueOnce(approveResponse);
    render(<AdminSignupRequestsPage />, { wrapper: Providers });

    fireEvent.click((await screen.findAllByRole('button', { name: '승인' }))[0]);

    expect(
      await screen.findAllByText(
        '가입신청을 승인했고 e2e-signup@example.com으로 안내 메일을 보냈습니다.',
      ),
    ).not.toHaveLength(0);
    expect(screen.getByRole('button', { name: '안내 메일 다시 보내기' })).toBeInTheDocument();
    expect(mocks.sendAdminSignupActivationEmail).not.toHaveBeenCalled();
  });

  it('자동 발송이 실패해도 승인 완료와 재발송·복사 경로를 안내한다', async () => {
    render(<AdminSignupRequestsPage />, { wrapper: Providers });

    fireEvent.click((await screen.findAllByRole('button', { name: '승인' }))[0]);

    expect(
      await screen.findAllByText(
        '승인은 완료됐지만 안내 메일을 보내지 못했습니다. 아래에서 다시 보내거나 링크·안내문구를 복사해 전달하세요.',
      ),
    ).not.toHaveLength(0);
    expect(screen.getByRole('button', { name: '안내 메일 보내기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '링크 복사' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '안내문구 복사' })).toBeInTheDocument();
  });

  it('승인 충돌은 서버가 알려 준 기존 회원 학번과 다음 행동을 보여 준다', async () => {
    const detail =
      '신청 이메일을 이미 다른 회원(학번 s65056)이 사용하고 있습니다. 같은 분인지 확인한 뒤 이 신청을 반려하거나, 회원 정보의 이메일을 정리한 뒤 다시 승인해 주세요.';
    mocks.approveAdminSignupRequest.mockRejectedValueOnce(
      new ApiError(409, detail, 'signup_email_in_use'),
    );
    render(<AdminSignupRequestsPage />, { wrapper: Providers });

    fireEvent.click((await screen.findAllByRole('button', { name: '승인' }))[0]);

    expect(await screen.findAllByText(detail)).not.toHaveLength(0);
    expect(screen.queryByText('승인 처리 중 오류가 발생했습니다.')).not.toBeInTheDocument();
  });

  it('자동 발송 실패 뒤 신청자 이메일로 안내 메일을 다시 보낸다', async () => {
    const sendLog = {
      id: 2,
      signup_request_id: 17,
      issued_type: 'send' as const,
      issued_by_student_id: 'admin01',
      token_tail: null,
      recipient_masked: 'e***@example.com',
      related_issue_id: 1,
      issued_at: '2026-08-23T10:00:00Z',
    };
    mocks.listAdminSignupRequestActivationTokenLogs
      .mockResolvedValueOnce({ items: [approveResponse.activation_issue] })
      .mockResolvedValueOnce({
        items: [sendLog, approveResponse.activation_issue],
      });

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
    expect(await screen.findByText(/안내 메일 · 담당 admin01/)).toBeInTheDocument();
    expect(screen.getByText(/e\*\*\*@example.com/)).toBeInTheDocument();
  });
});

const otherRequest: SignupRequestRead = {
  ...request,
  id: 18,
  student_id: 'e2e-other',
  email: 'e2e-other@example.com',
  name: '다른 신청',
};

const otherApprove: SignupActivationIssueResponse = {
  ...approveMailFailedResponse,
  request: { ...otherRequest, status: 'approved' },
  activation_context: {
    signup_request_id: 18,
    student_id: 'e2e-other',
    email: 'e2e-other@example.com',
    name: '다른 신청',
    cohort: 177,
  },
  activation_token: 'other-activation-token',
  activation_issue: { ...approveResponse.activation_issue, id: 2, signup_request_id: 18 },
};

const MAIL_FAILED_BANNER =
  '승인은 완료됐지만 안내 메일을 보내지 못했습니다. 아래에서 다시 보내거나 링크·안내문구를 복사해 전달하세요.';

function feedbackBanner(): HTMLElement {
  const banner = screen
    .getAllByRole('status')
    .find((element) => element.className.includes('rounded border px-3 py-2'));
  if (banner == null) throw new Error('feedback banner not found');
  return banner;
}

describe('가입신청 안내 메일 재발송 경쟁', () => {
  let resolveSend: (value: { sent_to: string }) => void = () => undefined;
  let rejectSend: (error: unknown) => void = () => undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.status = 'authorized';
    mocks.auth.data = { roles: ['member', 'admin', 'admin_signup'] };
    mocks.listAdminSignupRequests.mockResolvedValue({
      items: [request, otherRequest],
      total: 2,
    });
    mocks.approveAdminSignupRequest.mockImplementation((id: number) =>
      Promise.resolve(id === 18 ? otherApprove : approveMailFailedResponse),
    );
    mocks.listAdminSignupRequestActivationTokenLogs.mockResolvedValue({ items: [] });
    mocks.sendAdminSignupActivationEmail.mockImplementation(
      () =>
        new Promise((resolve, reject) => {
          resolveSend = resolve;
          rejectSend = reject;
        }),
    );
  });

  async function startResendForFirstThenApproveSecond() {
    render(<AdminSignupRequestsPage />, { wrapper: Providers });
    fireEvent.click((await screen.findAllByRole('button', { name: '승인' }))[0]);
    fireEvent.click(await screen.findByRole('button', { name: '안내 메일 보내기' }));
    await waitFor(() => {
      expect(mocks.sendAdminSignupActivationEmail).toHaveBeenCalledWith(17, 'mock-activation-token');
    });
    const approveButtons = screen.getAllByRole('button', { name: '승인' });
    fireEvent.click(approveButtons[approveButtons.length - 1]);
    expect(await screen.findByText(/최근 발급 대상: 다른 신청/)).toBeInTheDocument();
    await waitFor(() => expect(feedbackBanner()).toHaveTextContent(MAIL_FAILED_BANNER));
  }

  it('늦은 재발송 성공은 토스트로 대상만 알리고 다른 신청 카드와 배너를 바꾸지 않는다', async () => {
    await startResendForFirstThenApproveSecond();
    const logCallsBefore = mocks.listAdminSignupRequestActivationTokenLogs.mock.calls.length;

    resolveSend({ sent_to: 'e2e-signup@example.com' });

    expect(
      await screen.findByText(
        '합성 가입신청(e2e-signup) 안내 메일을 e2e-signup@example.com으로 보냈습니다.',
      ),
    ).toBeInTheDocument();
    expect(feedbackBanner()).toHaveTextContent(MAIL_FAILED_BANNER);
    expect(screen.getByText(/최근 발급 대상: 다른 신청/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '안내 메일 다시 보내기' })).not.toBeInTheDocument();
    expect(mocks.listAdminSignupRequestActivationTokenLogs.mock.calls.length).toBe(logCallsBefore);
  });

  it('늦은 재발송 실패도 현재 카드 배너를 바꾸지 않고 토스트에 대상을 밝힌다', async () => {
    await startResendForFirstThenApproveSecond();

    rejectSend(new ApiError(502, '안내 메일을 보내지 못했습니다.', 'email_send_failed'));

    expect(
      await screen.findByText(/^합성 가입신청\(e2e-signup\) 안내 메일을 보내지 못했습니다/),
    ).toBeInTheDocument();
    expect(feedbackBanner()).toHaveTextContent(MAIL_FAILED_BANNER);
  });
});

describe('가입신청 발급 이력 조회 순서', () => {
  it('같은 신청을 재발급하면 늦게 온 이전 이력 응답이 최신 기록을 덮지 않고, 조회 중에는 이전 이력을 숨긴다', async () => {
    vi.clearAllMocks();
    mocks.auth.status = 'authorized';
    mocks.auth.data = { roles: ['member', 'admin', 'admin_signup'] };
    const approvedRequest = { ...request, status: 'approved' as const };
    mocks.listAdminSignupRequests.mockResolvedValue({ items: [approvedRequest], total: 1 });
    const reissueLog = {
      ...approveResponse.activation_issue,
      id: 3,
      issued_type: 'reissue' as const,
      issued_by_student_id: 'admin-new',
    };
    const oldLog = { ...approveResponse.activation_issue, issued_by_student_id: 'admin-old' };
    mocks.reissueAdminSignupRequestActivationToken
      .mockResolvedValueOnce({ ...approveResponse, activation_email: { status: 'not_attempted', sent_to: null, error_code: null } })
      .mockResolvedValueOnce({
        ...approveResponse,
        activation_issue: reissueLog,
        activation_token: 'newer-token',
        activation_email: { status: 'not_attempted', sent_to: null, error_code: null },
      });
    let resolveOld: (value: { items: unknown[] }) => void = () => undefined;
    mocks.listAdminSignupRequestActivationTokenLogs
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockResolvedValueOnce({ items: [reissueLog, oldLog] });

    render(<AdminSignupRequestsPage />, { wrapper: Providers });
    fireEvent.click((await screen.findAllByRole('button', { name: '재발급' }))[0]);
    expect(await screen.findByText('발급 이력을 불러오는 중입니다.')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: '재발급' })[0]);

    // 카드 머리말(최근 발급)과 이력 목록에 최신 재발급이 함께 보인다.
    await waitFor(() => {
      expect(screen.getAllByText(/재발급 · 담당 admin-new/)).toHaveLength(2);
    });
    resolveOld({ items: [oldLog] });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getAllByText(/재발급 · 담당 admin-new/)).toHaveLength(2);
  });
});
