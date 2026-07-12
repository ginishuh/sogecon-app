import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { vi } from 'vitest';

import EventDetailPage from '../app/events/[id]/page';

const getEventMock = vi.fn();
const getOptionalRsvpMock = vi.fn();
const upsertEventRsvpMock = vi.fn();
const showToastMock = vi.fn();

vi.mock('next/navigation', () => ({ useParams: () => ({ id: '1' }), notFound: vi.fn() }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ status: 'authorized', data: { id: 9 } }) }));
vi.mock('../components/toast', () => ({ useToast: () => ({ show: showToastMock }) }));
vi.mock('../services/events', () => ({
  getEvent: (...args: unknown[]) => getEventMock(...args),
  upsertEventRsvp: (...args: unknown[]) => upsertEventRsvpMock(...args),
}));
vi.mock('../services/rsvps', () => ({ getOptionalRsvp: (...args: unknown[]) => getOptionalRsvpMock(...args) }));

const event = {
  id: 1,
  title: '서강 동문 모임',
  location: '서강대학교',
  starts_at: '2026-08-01T09:00:00+09:00',
  ends_at: '2026-08-01T11:00:00+09:00',
  capacity: 50,
  description: '함께 만나는 자리입니다.',
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><EventDetailPage /></QueryClientProvider>);
}

describe('행사 참여 사용자 여정', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getEventMock.mockResolvedValue(event);
    upsertEventRsvpMock.mockResolvedValue(undefined);
  });

  it('미신청에서 참여 신청 후 완료 상태를 안내한다', async () => {
    getOptionalRsvpMock.mockResolvedValueOnce(null).mockResolvedValue({ status: 'going' });
    renderPage();

    expect(await screen.findByText('아직 신청하지 않았어요')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '참여 신청하기' }));

    await waitFor(() => expect(upsertEventRsvpMock).toHaveBeenCalledWith(1, 9, 'going'));
    expect(await screen.findByText('행사 참여 신청이 완료되었습니다.')).toBeInTheDocument();
  });

  it('신청 완료 상태에서는 취소 행동만 제공한다', async () => {
    getOptionalRsvpMock.mockResolvedValue({ status: 'going' });
    renderPage();

    expect(await screen.findByText('참여 신청 완료')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '참여 신청하기' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '참여 취소' }));
    await waitFor(() => expect(upsertEventRsvpMock).toHaveBeenCalledWith(1, 9, 'cancel'));
  });
});
