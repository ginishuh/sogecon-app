import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ChangePasswordPage from '../app/settings/password/page';

const changePasswordMock = vi.fn();
const toastShowMock = vi.fn();

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ status: 'authorized' }),
}));

vi.mock('../components/toast', () => ({
  useToast: () => ({ show: toastShowMock }),
}));

vi.mock('../services/member', () => ({
  changePassword: (...args: unknown[]) => changePasswordMock(...args),
}));

describe('비밀번호 변경 화면', () => {
  beforeEach(() => {
    changePasswordMock.mockReset();
    toastShowMock.mockReset();
  });

  it('UTF-8 72바이트 초과를 화면에 안내하고 요청하지 않는다', () => {
    render(<ChangePasswordPage />);

    fireEvent.change(screen.getByLabelText('현재 비밀번호'), {
      target: { value: 'current-password' },
    });
    fireEvent.change(screen.getByLabelText('새 비밀번호'), {
      target: { value: '한'.repeat(25) },
    });
    fireEvent.click(screen.getByRole('button', { name: '변경' }));

    expect(screen.getByRole('status')).toHaveTextContent(
      '비밀번호는 UTF-8 기준 72바이트 이하여야 합니다.'
    );
    expect(changePasswordMock).not.toHaveBeenCalled();
  });
});
