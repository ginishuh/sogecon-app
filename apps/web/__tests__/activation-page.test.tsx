import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ActivatePage from '../app/activate/page';
import { ApiError } from '../lib/api';

const activateMock = vi.fn();
const invalidateMock = vi.fn(() => Promise.resolve());
const showMock = vi.fn();
let activationToken = '';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(activationToken ? `token=${activationToken}` : ''),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ status: 'unauthorized', invalidate: invalidateMock }),
}));

vi.mock('../components/toast', () => ({
  useToast: () => ({ show: showMock }),
}));

vi.mock('../services/member', () => ({
  activate: (...args: unknown[]) => activateMock(...args),
}));

describe('첫 로그인 설정 화면', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    activationToken = '';
    activateMock.mockReset();
    invalidateMock.mockClear();
    showMock.mockReset();
  });

  it('링크 없이 방문하면 코드 입력을 보조 경로로 숨긴다', () => {
    render(<ActivatePage />);

    expect(screen.getByRole('heading', { name: '비밀번호 만들기' })).toBeInTheDocument();
    expect(screen.queryByLabelText('계정 활성화 코드')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '안내를 받지 못했어요' })).toHaveAttribute(
      'href',
      '/support/contact'
    );

    fireEvent.click(screen.getByRole('button', { name: '코드 직접 입력하기' }));
    expect(screen.getByLabelText('계정 활성화 코드')).toBeRequired();
    expect(screen.getByLabelText('계정 활성화 코드')).toHaveFocus();
    expect(screen.getByLabelText('새 비밀번호')).toBeRequired();
  });

  it('안내 링크로 방문하면 코드 입력 없이 비밀번호만 받는다', () => {
    activationToken = 'signed-link-token';
    window.history.replaceState({}, '', '/activate?token=signed-link-token');
    const replaceState = vi.spyOn(window.history, 'replaceState');
    render(<ActivatePage />);

    expect(screen.getByText('안내 링크에서 코드를 불러왔습니다.')).toBeInTheDocument();
    expect(screen.queryByLabelText('계정 활성화 코드')).not.toBeInTheDocument();
    expect(screen.getByLabelText('새 비밀번호')).toHaveAttribute('autocomplete', 'new-password');
    expect(replaceState).toHaveBeenCalledWith(window.history.state, '', '/activate');
    replaceState.mockRestore();
  });

  it('만료된 링크는 사무국 문의 행동을 제공한다', async () => {
    activationToken = 'expired-token';
    activateMock.mockRejectedValueOnce(
      new ApiError(401, 'invalid_or_expired_activation_token')
    );
    render(<ActivatePage />);

    fireEvent.change(screen.getByLabelText('새 비밀번호'), {
      target: { value: 'safe-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 만들기 완료' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('사용 기한이 지났습니다');
    });
    expect(screen.getByRole('link', { name: '동문회 사무국에 문의하기' })).toHaveAttribute(
      'href',
      '/support/contact'
    );
    expect(showMock).not.toHaveBeenCalled();
  });

  it('이미 사용한 링크는 로그인 행동을 제공한다', async () => {
    activationToken = 'used-token';
    activateMock.mockRejectedValueOnce(new ApiError(409, 'activation_already_used'));
    render(<ActivatePage />);

    fireEvent.change(screen.getByLabelText('새 비밀번호'), {
      target: { value: 'safe-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 만들기 완료' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('이미 비밀번호 만들기를 마친 안내');
    });
    expect(screen.getByRole('link', { name: '로그인하기' })).toHaveAttribute('href', '/login');
    expect(showMock).not.toHaveBeenCalled();
  });

  it('완료하면 4단계와 다음 동문 메뉴를 안내한다', async () => {
    activationToken = 'valid-token';
    activateMock.mockResolvedValueOnce({ ok: 'true' });
    render(<ActivatePage />);

    fireEvent.change(screen.getByLabelText('새 비밀번호'), {
      target: { value: 'safe-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 만들기 완료' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '첫 로그인 완료' })).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: '내 정보 확인하기' })).toHaveAttribute('href', '/me');
    expect(activateMock).toHaveBeenCalledWith({
      token: 'valid-token',
      password: 'safe-password',
    });
  });
});
