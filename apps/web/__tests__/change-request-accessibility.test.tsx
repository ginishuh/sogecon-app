import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { vi } from 'vitest';

import { ChangeRequestSection } from '../app/me/change-request';
import { listMyChangeRequests } from '../services/me';

vi.mock('../components/toast', () => ({ useToast: () => ({ show: vi.fn() }) }));
vi.mock('../services/me', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/me')>();
  return {
    ...actual,
    createChangeRequest: vi.fn(),
    listMyChangeRequests: vi.fn().mockResolvedValue([]),
  };
});

const profile = {
  id: 9,
  student_id: 'e2e215',
  email: 'member@example.com',
  name: '서강 동문',
  cohort: 61,
  roles: 'member',
  status: 'active' as const,
  visibility: 'all' as const,
  major: null,
  birth_date: null,
  birth_lunar: null,
  phone: null,
  company: null,
  department: null,
  job_title: null,
  company_phone: null,
  addr_personal: null,
  addr_company: null,
  industry: null,
  avatar_url: null,
};

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ChangeRequestSection profile={profile} />
    </QueryClientProvider>,
  );
}

describe('이름·기수 변경 요청 접근성', () => {
  beforeEach(() => {
    vi.mocked(listMyChangeRequests).mockReset().mockResolvedValue([]);
  });

  it('모든 변경 조작에 최소 44px 높이 계약을 적용한다', async () => {
    renderSection();

    expect(await screen.findByRole('heading', { name: '이름·기수 변경 요청' })).toBeInTheDocument();
    expect(await screen.findByText('아직 접수한 변경 요청이 없어요.')).toBeInTheDocument();
    const nameButton = screen.getByRole('button', { name: '이름 변경 요청' });
    const cohortButton = screen.getByRole('button', { name: '기수 변경 요청' });
    expect(nameButton).toHaveClass('min-h-11');
    expect(cohortButton).toHaveClass('min-h-11');

    fireEvent.click(nameButton);
    expect(screen.getByPlaceholderText('새 이름 입력')).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: '요청' })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: '취소' })).toHaveClass('min-h-11');
  });

  it('요청 이력을 불러오는 동안 빈 상태를 먼저 보여주지 않는다', async () => {
    renderSection();

    expect(screen.getByRole('status')).toHaveTextContent('변경 요청 이력을 불러오는 중');
    expect(screen.queryByText('아직 접수한 변경 요청이 없어요.')).not.toBeInTheDocument();
    expect(await screen.findByText('아직 접수한 변경 요청이 없어요.')).toBeInTheDocument();
  });

  it('요청 이력 조회 실패를 빈 상태로 숨기지 않고 다시 확인할 수 있다', async () => {
    vi.mocked(listMyChangeRequests)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce([]);
    renderSection();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '변경 요청 이력을 불러오지 못했어요.',
    );
    expect(screen.queryByText('아직 접수한 변경 요청이 없어요.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '다시 확인하기' }));

    expect(await screen.findByText('아직 접수한 변경 요청이 없어요.')).toBeInTheDocument();
  });

  it('같은 필드의 대기 요청이 있으면 opener 단계에서 중복 요청을 차단한다', async () => {
    vi.mocked(listMyChangeRequests).mockResolvedValueOnce([
      {
        id: 1,
        member_id: profile.id,
        field_name: 'name',
        old_value: profile.name,
        new_value: '새 이름',
        status: 'pending',
        requested_at: '2026-07-14T00:00:00Z',
      },
    ]);
    renderSection();

    const nameButton = await screen.findByRole('button', { name: '이름 변경 요청' });
    await waitFor(() => expect(nameButton).toBeDisabled());
    expect(nameButton).toHaveAccessibleDescription('이미 확인 중인 이름 변경 요청이 있어요.');
    expect(screen.getByRole('button', { name: '기수 변경 요청' })).toBeEnabled();
  });
});
