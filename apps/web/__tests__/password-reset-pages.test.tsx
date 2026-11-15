import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ForgotPasswordPage from '../app/forgot-password/page';
import ResetPasswordPage from '../app/reset-password/page';
import { ApiError } from '../lib/api';

const requestMock = vi.fn();
const confirmMock = vi.fn();
const invalidateMock = vi.fn(() => Promise.resolve());
const showMock = vi.fn();
const replaceMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ status: 'unauthorized', invalidate: invalidateMock }),
}));

vi.mock('../components/toast', () => ({
  useToast: () => ({ show: showMock }),
}));

vi.mock('../services/member', () => ({
  requestPasswordReset: (...args: unknown[]) => requestMock(...args),
  confirmPasswordReset: (...args: unknown[]) => confirmMock(...args),
}));

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  requestMock.mockReset();
  confirmMock.mockReset();
  invalidateMock.mockClear();
  showMock.mockReset();
  replaceMock.mockReset();
});

function fillForgot(studentId: string, email: string) {
  fireEvent.change(screen.getByLabelText('학번'), { target: { value: studentId } });
  fireEvent.change(screen.getByLabelText('이메일'), { target: { value: email } });
  fireEvent.click(screen.getByRole('button', { name: '재설정 링크 받기' }));
}

describe('비밀번호 찾기 화면', () => {
  it('요청 후 계정 일치 여부를 드러내지 않는 안내를 보여준다', async () => {
    requestMock.mockResolvedValueOnce({ ok: 'true' });
    render(<ForgotPasswordPage />);

    fillForgot(' 20260001 ', ' me@example.com ');

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('일치하면 재설정 링크를 보냈습니다'));
    expect(requestMock).toHaveBeenCalledWith({ student_id: '20260001', email: 'me@example.com' });
    expect(screen.getByRole('link', { name: '로그인으로 돌아가기' })).toHaveAttribute('href', '/login');
  });

  it('요청 한도를 넘으면 다시 시도 안내를 보여준다', async () => {
    requestMock.mockRejectedValueOnce(new ApiError(429, 'rate_limited', 'rate_limited'));
    render(<ForgotPasswordPage />);

    fillForgot('20260001', 'me@example.com');

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('잠시 후 다시 시도해 주세요'));
    expect(screen.getByLabelText('학번')).toHaveAttribute('aria-describedby', 'forgot-password-error');
  });

  it('메일 발송을 쓸 수 없으면 사무국 문의로 안내한다', async () => {
    requestMock.mockRejectedValueOnce(new ApiError(409, 'email_not_configured', 'email_not_configured'));
    render(<ForgotPasswordPage />);

    fillForgot('20260001', 'me@example.com');

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('지금은 재설정 메일을 보낼 수 없습니다'));
    expect(screen.getByRole('link', { name: '동문회 사무국에 문의하기' })).toHaveAttribute('href', '/support/contact');
  });
});

function fillReset(password: string, confirm: string) {
  fireEvent.change(screen.getByLabelText('새 비밀번호'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('새 비밀번호 확인'), { target: { value: confirm } });
  fireEvent.click(screen.getByRole('button', { name: '새 비밀번호 저장' }));
}

describe('새 비밀번호 만들기 화면', () => {
  it('fragment의 링크 토큰을 주소에서 지우고 성공하면 로그인 화면으로 보낸다', async () => {
    window.history.replaceState({}, '', '/reset-password#token=signed-reset-token');
    confirmMock.mockResolvedValueOnce({ ok: 'true' });
    render(<ResetPasswordPage />);

    expect(await screen.findByLabelText('새 비밀번호')).toHaveAttribute('autocomplete', 'new-password');
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/reset-password');
    fillReset('brand-new-pass', 'brand-new-pass');

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/login'));
    expect(confirmMock).toHaveBeenCalledWith({ token: 'signed-reset-token', password: 'brand-new-pass' });
    expect(invalidateMock).toHaveBeenCalled();
    expect(showMock).toHaveBeenCalledWith(expect.stringContaining('새 비밀번호로 로그인'), { type: 'success' });
  });

  it('StrictMode에서 effect가 두 번 실행돼도 fragment 토큰을 유지한다', async () => {
    window.history.replaceState({}, '', '/reset-password#token=strict-token');
    confirmMock.mockResolvedValueOnce({ ok: 'true' });
    render(
      <React.StrictMode>
        <ResetPasswordPage />
      </React.StrictMode>
    );

    await screen.findByLabelText('새 비밀번호');
    fillReset('brand-new-pass', 'brand-new-pass');

    await waitFor(() => expect(confirmMock).toHaveBeenCalledWith({ token: 'strict-token', password: 'brand-new-pass' }));
    expect(window.location.hash).toBe('');
  });

  it('확인 값이 다르면 요청하지 않는다', async () => {
    window.history.replaceState({}, '', '/reset-password#token=signed-reset-token');
    render(<ResetPasswordPage />);
    await screen.findByLabelText('새 비밀번호');

    fillReset('brand-new-pass', 'brand-new-pas');

    expect(await screen.findByRole('alert')).toHaveTextContent('서로 다릅니다');
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it('만료되었거나 사용한 링크는 다시 받기 경로를 제공한다', async () => {
    window.history.replaceState({}, '', '/reset-password#token=used-token');
    confirmMock.mockRejectedValueOnce(
      new ApiError(400, 'invalid_or_expired_reset_token', 'invalid_or_expired_reset_token')
    );
    render(<ResetPasswordPage />);
    await screen.findByLabelText('새 비밀번호');

    fillReset('brand-new-pass', 'brand-new-pass');

    expect(await screen.findByRole('alert')).toHaveTextContent('사용 기한이 지났습니다');
    expect(screen.getByRole('link', { name: '재설정 링크 다시 받기' })).toHaveAttribute('href', '/forgot-password');
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('토큰 없이 방문하면 비밀번호 찾기로 안내한다', async () => {
    render(<ResetPasswordPage />);

    expect(await screen.findByRole('link', { name: '비밀번호 찾기' })).toHaveAttribute('href', '/forgot-password');
    expect(screen.queryByLabelText('새 비밀번호')).not.toBeInTheDocument();
  });

  it('쿼리스트링 토큰은 받지 않는다', async () => {
    window.history.replaceState({}, '', '/reset-password?token=leaky-token');
    render(<ResetPasswordPage />);

    expect(await screen.findByRole('link', { name: '비밀번호 찾기' })).toBeInTheDocument();
    expect(screen.queryByLabelText('새 비밀번호')).not.toBeInTheDocument();
  });
});
