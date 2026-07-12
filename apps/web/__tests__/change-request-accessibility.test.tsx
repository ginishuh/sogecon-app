import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { vi } from 'vitest';

import { ChangeRequestSection } from '../app/me/change-request';

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
  it('모든 변경 조작에 최소 44px 높이 계약을 적용한다', async () => {
    renderSection();

    const nameButton = await screen.findByRole('button', { name: '이름 변경 요청' });
    const cohortButton = screen.getByRole('button', { name: '기수 변경 요청' });
    expect(nameButton).toHaveClass('min-h-11');
    expect(cohortButton).toHaveClass('min-h-11');

    fireEvent.click(nameButton);
    expect(screen.getByPlaceholderText('새 이름 입력')).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: '요청' })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: '취소' })).toHaveClass('min-h-11');
  });
});
