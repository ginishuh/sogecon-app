import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { vi } from 'vitest';

import EventsPage from '../app/events/page';

const listEventsMock = vi.fn();

vi.mock('../services/events', () => ({
  listEvents: (...args: unknown[]) => listEventsMock(...args),
}));

const events = [
  {
    id: 1,
    title: '동문 네트워킹 데이',
    description: '함께 만나는 자리입니다.',
    location: '서강대학교 곤자가컨벤션',
    starts_at: '2099-07-18T16:00:00+09:00',
    ends_at: '2099-07-18T19:00:00+09:00',
    capacity: 120,
  },
  {
    id: 2,
    title: '글로벌 경제 전망 특강',
    description: null,
    location: '서강대학교 정하상관',
    starts_at: '2099-07-25T14:00:00+09:00',
    ends_at: '2099-07-25T16:30:00+09:00',
    capacity: 80,
  },
];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <EventsPage />
    </QueryClientProvider>,
  );
}

describe('행사 일정 목록', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listEventsMock.mockResolvedValue([]);
  });

  it('페이지 목적과 선택된 시기, 다음 행동이 있는 빈 상태를 안내한다', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: '다가오는 행사' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '예정된 행사' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '지난 행사' })).toHaveAttribute('aria-pressed', 'false');
    expect(await screen.findByText('등록된 예정 행사가 없습니다.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '알림 이용 안내' })).toHaveClass('min-h-11');

    fireEvent.click(screen.getByRole('button', { name: '지난 행사' }));
    expect(screen.getByRole('button', { name: '지난 행사' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: '지난 행사' })).toBeInTheDocument();
    expect(screen.getByText('지난 행사가 아직 없습니다.')).toBeInTheDocument();
  });

  it('가장 가까운 행사와 이후 행사를 날짜순으로 구분한다', async () => {
    listEventsMock.mockResolvedValue(events);
    renderPage();

    expect(await screen.findByRole('heading', { name: '동문 네트워킹 데이' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '글로벌 경제 전망 특강' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /행사 자세히 보기/ })).toHaveAttribute('href', '/events/1');
    expect(screen.getByRole('link', { name: '자세히 보기' })).toHaveAttribute('href', '/events/2');
    expect(screen.getAllByText('예정')).toHaveLength(2);
  });

  it('지난 행사 목록의 제목과 보조공학 라벨을 과거 맥락으로 바꾼다', async () => {
    listEventsMock.mockResolvedValue([
      { ...events[0], id: 10, starts_at: '2020-07-18T16:00:00+09:00', ends_at: '2020-07-18T19:00:00+09:00' },
      { ...events[1], id: 11, starts_at: '2020-07-25T14:00:00+09:00', ends_at: '2020-07-25T16:30:00+09:00' },
    ]);
    renderPage();

    await screen.findByRole('heading', { name: '다가오는 행사' });
    fireEvent.click(screen.getByRole('button', { name: '지난 행사' }));

    expect(screen.getByRole('heading', { name: '지난 행사' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '최근 지난 행사' })).toHaveClass('sr-only');
    expect(screen.getAllByText('종료')).toHaveLength(2);
  });
});
