import { fireEvent, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { vi } from 'vitest';

import LoginPage from '../app/login/page';
import { ApiError } from '../lib/api';
import { renderWithProviders } from '../tests/render-with-providers';

const showMock = vi.fn();
const replaceMock = vi.fn();
const invalidateMock = vi.fn(() => Promise.resolve());
const loginMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('../components/toast', () => ({
  useToast: () => ({ show: showMock }),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ invalidate: invalidateMock }),
}));

vi.mock('../services/auth', () => ({
  login: (...args: unknown[]) => loginMock(...(args as Parameters<typeof loginMock>)),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    showMock.mockReset();
    replaceMock.mockReset();
    invalidateMock.mockClear();
    loginMock.mockReset();
  });

  it('승인 대기 계정은 구체적인 안내 메시지를 표시한다', async () => {
    loginMock.mockRejectedValueOnce(
      new ApiError(403, 'member_pending_approval', 'member_pending_approval')
    );

    renderWithProviders(<LoginPage />);

    fireEvent.change(screen.getByLabelText('학번'), { target: { value: '20260001' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => {
      expect(showMock).toHaveBeenCalledWith(
        '가입 승인 대기 중입니다. 관리자 승인 후 계정 활성화를 진행해 주세요.',
        { type: 'error' }
      );
    });
  });

  it('비활성 계정은 비활성 안내 메시지를 표시한다', async () => {
    loginMock.mockRejectedValueOnce(new ApiError(403, 'member_not_active', 'member_not_active'));

    renderWithProviders(<LoginPage />);

    fireEvent.change(screen.getByLabelText('학번'), { target: { value: 'inactive001' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => {
      expect(showMock).toHaveBeenCalledWith('비활성 상태 계정입니다. 관리자에게 문의해 주세요.', { type: 'error' });
    });
  });

  it('학번/비밀번호 불일치 시 기본 로그인 실패 메시지를 표시한다', async () => {
    loginMock.mockRejectedValueOnce(new ApiError(401, 'login_failed', 'login_failed'));

    renderWithProviders(<LoginPage />);

    fireEvent.change(screen.getByLabelText('학번'), { target: { value: 'user001' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => {
      expect(showMock).toHaveBeenCalledWith('학번 또는 비밀번호가 올바르지 않습니다.', { type: 'error' });
    });
  });
});
