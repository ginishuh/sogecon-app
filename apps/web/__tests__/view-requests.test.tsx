import { fireEvent, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ViewRequestInbox } from '../app/me/view-requests';
import { renderWithProviders } from '../tests/render-with-providers';

const listMock = vi.fn();
const acceptMock = vi.fn();
const declineMock = vi.fn();
const revokeMock = vi.fn();
const showMock = vi.fn();

vi.mock('../components/toast', () => ({
  useToast: () => ({ show: showMock }),
}));

vi.mock('../services/me', () => ({
  listIncomingViewRequests: (...args: unknown[]) => listMock(...args),
  acceptViewRequest: (...args: unknown[]) => acceptMock(...args),
  declineViewRequest: (...args: unknown[]) => declineMock(...args),
  revokeViewRequest: (...args: unknown[]) => revokeMock(...args),
}));

const pending = {
  id: 11,
  requester_id: 2,
  requester_name: '홍길동',
  requester_cohort: 61,
  target_id: 1,
  status: 'pending' as const,
  created_at: '2026-08-20T00:00:00Z',
  decided_at: null,
};

const accepted = {
  ...pending,
  id: 12,
  status: 'accepted' as const,
  decided_at: '2026-08-20T01:00:00Z',
};

describe('동문 수첩 보기 요청 수신함', () => {
  beforeEach(() => {
    listMock.mockReset();
    acceptMock.mockReset();
    declineMock.mockReset();
    revokeMock.mockReset();
    showMock.mockReset();
  });

  it('대기 요청에 개별 제공 고지와 허용·거절을 보여 준다', async () => {
    listMock.mockResolvedValue([pending]);
    renderWithProviders(<ViewRequestInbox />);

    expect(await screen.findByText('홍길동(61기)에게 내 동문 수첩 상세정보를 제공합니다.')).toBeInTheDocument();
    expect(screen.getByText('목적: 동문 간 연락')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '허용' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '거절' })).toBeInTheDocument();

    acceptMock.mockResolvedValue({ ...pending, status: 'accepted' });
    fireEvent.click(screen.getByRole('button', { name: '허용' }));
    await waitFor(() => expect(acceptMock.mock.calls[0]?.[0]).toBe(11));
  });

  it('허용 중인 요청은 같은 화면에서 취소한다', async () => {
    listMock.mockResolvedValue([accepted]);
    renderWithProviders(<ViewRequestInbox />);

    expect(await screen.findByText(/허용 중/)).toBeInTheDocument();
    revokeMock.mockResolvedValue({ ...accepted, status: 'revoked' });
    fireEvent.click(screen.getByRole('button', { name: '허용 취소' }));
    await waitFor(() => expect(revokeMock.mock.calls[0]?.[0]).toBe(12));
  });
});
