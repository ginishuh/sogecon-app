import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DirectoryConsentPage from '../app/directory-consent/page';

const submitMock = vi.fn();
const invalidateMock = vi.fn(() => Promise.resolve());
const showMock = vi.fn();
const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ status: 'authorized', invalidate: invalidateMock }),
  useRequireAuth: () => ({ status: 'authorized' }),
}));

vi.mock('../components/toast', () => ({
  useToast: () => ({ show: showMock }),
}));

vi.mock('../services/me', () => ({
  submitDirectoryConsent: (...args: unknown[]) => submitMock(...args),
}));

describe('동문 수첩 공개 동의 화면', () => {
  beforeEach(() => {
    submitMock.mockReset();
    invalidateMock.mockClear();
    showMock.mockReset();
    replaceMock.mockReset();
  });

  it('공개 선택이면 동의 확인 없이 저장하지 않는다', () => {
    render(<DirectoryConsentPage />);

    expect(screen.getByRole('heading', { name: '동문 수첩에 정보를 공개할까요?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '동의하고 저장하기' }));
    expect(submitMock).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('공개하려면 아래 안내에 동의해 주세요.');
  });

  it('잠가 두기를 고르면 동의 확인 없이 저장한다', async () => {
    submitMock.mockResolvedValueOnce({ visibility: 'private' });
    render(<DirectoryConsentPage />);

    fireEvent.click(screen.getByRole('radio', { name: /잠가 두기/ }));
    fireEvent.click(screen.getByRole('button', { name: '공개하지 않고 시작하기' }));

    await waitFor(() => {
      expect(submitMock).toHaveBeenCalledWith('private');
    });
    expect(replaceMock).toHaveBeenCalledWith('/');
  });
});
