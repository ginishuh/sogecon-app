import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { vi } from 'vitest';

import DirectoryPage from '../app/directory/page';

const replaceMock = vi.fn();
let currentSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => currentSearchParams,
}));

const listMembersMock = vi.fn();
const countMembersMock = vi.fn();

vi.mock('../services/members', () => ({
  listMembers: (...args: unknown[]) => listMembersMock(...(args as Parameters<typeof listMembersMock>)),
  countMembers: (...args: unknown[]) => countMembersMock(...(args as Parameters<typeof countMembersMock>)),
}));

class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

function renderDirectory() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <DirectoryPage />
    </QueryClientProvider>
  );
}

describe('DirectoryPage 공유 링크/페이지 요약', () => {
  beforeEach(() => {
    replaceMock.mockReset();
    listMembersMock.mockReset();
    countMembersMock.mockReset();
    currentSearchParams = new URLSearchParams([
      ['sort', 'cohort_asc'],
      ['page', '2'],
    ]);

    const makePage = (offset: number) =>
      Array.from({ length: offset >= 20 ? 5 : 10 }, (_, idx) => ({
        id: offset + idx + 1,
        email: `user${offset + idx}@example.com`,
        name: `User ${offset + idx}`,
        cohort: 1,
        major: null,
        company: null,
        industry: null,
        roles: 'member' as const,
        visibility: 'all' as const,
      }));

    listMembersMock.mockImplementation(({ offset }: { offset: number }) =>
      Promise.resolve(makePage(offset))
    );
    countMembersMock.mockResolvedValue(25);
  });

  it('URL 파라미터와 연동된 요약/공유 링크를 표시한다', async () => {
    renderDirectory();

    await waitFor(() => {
      expect(listMembersMock).toHaveBeenCalledTimes(3);
    });

    // 공유 링크 패널 토글 후 링크 노출 확인
    const toggle = screen.getByRole('button', { name: '링크 표시' });
    toggle.click();

    expect(screen.getByText('/directory?sort=cohort_asc&page=2')).toBeInTheDocument();
    expect(screen.getByText('총 25명 중 25명 표시 (페이지 3 / 3)')).toBeInTheDocument();
  });
});
