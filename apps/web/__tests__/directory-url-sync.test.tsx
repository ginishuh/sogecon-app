import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { vi } from 'vitest';

import DirectoryPage from '../app/directory/page';

const replaceMock = vi.fn((url: string) => {
  const query = url.split('?')[1] ?? '';
  currentSearchParams = new URLSearchParams(query);
});
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

function renderDirectoryPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <DirectoryPage />
    </QueryClientProvider>
  );
}

describe('DirectoryPage URL 동기화', () => {
  beforeEach(() => {
    replaceMock.mockClear();
    listMembersMock.mockReset();
    countMembersMock.mockReset();
    currentSearchParams = new URLSearchParams();
    listMembersMock.mockResolvedValue([]);
    countMembersMock.mockResolvedValue(0);
  });

  it('입력 디바운스 후 URL 쿼리를 업데이트한다', async () => {
    listMembersMock.mockResolvedValueOnce([]);
    countMembersMock.mockResolvedValueOnce(0);

    renderDirectoryPage();

    const searchInput = screen.getByLabelText('검색어');
    fireEvent.change(searchInput, { target: { value: 'alice' } });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/directory?q=alice', { scroll: false });
    });
  });

  it('검색 무결과에서 모든 필터를 한 번에 초기화한다', async () => {
    currentSearchParams = new URLSearchParams([['q', '없는동문']]);
    renderDirectoryPage();

    const reset = await screen.findByRole('button', { name: '모든 필터 초기화' });
    fireEvent.click(reset);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/directory', { scroll: false }));
  });

  it('정렬 옵션을 변경하면 URL과 목록을 최신화한다', async () => {
    renderDirectoryPage();

    const sortSelect = screen.getByLabelText('정렬 옵션');
    fireEvent.change(sortSelect, { target: { value: 'cohort_desc' } });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/directory?sort=cohort_desc', { scroll: false });
    });
    await waitFor(() => {
      expect(listMembersMock).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'cohort_desc' }));
    });
  });

  it('직함 필터를 적용하면 job_title 파라미터를 추가한다', async () => {
    renderDirectoryPage();

    const disclosure = screen.getByRole('button', { name: '상세 검색' });
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    expect(disclosure).toHaveAttribute('aria-controls', 'directory-advanced-filters');
    fireEvent.click(disclosure);
    expect(screen.getByRole('button', { name: '상세 검색 닫기' })).toHaveAttribute('aria-expanded', 'true');

    const jobTitleInput = screen.getByLabelText('직함');
    fireEvent.change(jobTitleInput, { target: { value: '팀장' } });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalled();
    });
    const lastUrl = replaceMock.mock.calls.at(-1)?.[0] as string;
    const params = new URLSearchParams(lastUrl.split('?')[1] ?? '');
    expect(params.get('job_title')).toBe('팀장');
    expect(listMembersMock).toHaveBeenLastCalledWith(expect.objectContaining({ jobTitle: '팀장' }));
  });

  it('기본 검색 결과가 있어도 한 번에 기본 상태로 초기화한다', async () => {
    currentSearchParams = new URLSearchParams([['q', 'E2E']]);
    const member = {
      id: 177,
      email: 'e2e177@example.com',
      name: 'E2E 테스트 회원',
      cohort: 177,
      major: null,
      company: null,
      industry: null,
      roles: 'member' as const,
      visibility: 'all' as const,
    };
    listMembersMock.mockResolvedValue([member]);
    countMembersMock.mockResolvedValue(1);

    renderDirectoryPage();

    const reset = await screen.findByRole('button', { name: '검색 조건과 정렬 초기화' });
    fireEvent.click(reset);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/directory', { scroll: false }));
  });

  it('데스크톱 결과를 표가 아닌 편집형 행으로 제공한다', async () => {
    const member = {
      id: 177,
      email: 'e2e177@example.com',
      name: 'E2E 테스트 회원',
      cohort: 177,
      major: null,
      company: '서강동문회사',
      job_title: '대표',
      industry: null,
      roles: 'member' as const,
      visibility: 'all' as const,
    };
    listMembersMock.mockResolvedValue([member]);
    countMembersMock.mockResolvedValue(1);

    renderDirectoryPage();
    await screen.findAllByText('E2E 테스트 회원');

    expect(document.querySelector('table')).not.toBeInTheDocument();
    const desktopList = Array.from(document.querySelectorAll('ul')).find((element) => element.classList.contains('lg:block'));
    expect(desktopList).toBeTruthy();
    expect(within(desktopList as HTMLElement).getByText('서강동문회사 · 대표')).toBeInTheDocument();
    expect(within(desktopList as HTMLElement).getByText('모든 동문에게 공개')).toBeInTheDocument();
    expect(within(desktopList as HTMLElement).queryByText('공개하지 않음')).not.toBeInTheDocument();
  });

  it('더 불러오기 시 page 파라미터를 증가시킨다', async () => {
    const makePage = (offset: number) =>
      Array.from({ length: 10 }, (_, idx) => ({
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

    listMembersMock
      .mockResolvedValueOnce(makePage(0))
      .mockResolvedValueOnce(makePage(10))
      .mockResolvedValueOnce([]);
    countMembersMock.mockResolvedValue(25);

    renderDirectoryPage();

    await waitFor(() => expect(listMembersMock).toHaveBeenCalledTimes(1));

    const loadMoreButton = await screen.findByRole('button', { name: /더 불러오기/ });
    fireEvent.click(loadMoreButton);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/directory?page=1', { scroll: false });
    });
  });

  it('page 파라미터가 있는 URL을 열면 해당 페이지까지 프리패치한다', async () => {
    currentSearchParams = new URLSearchParams([['page', '2']]);

    const makePage = (offset: number) =>
      Array.from({ length: 10 }, (_, idx) => ({
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

    listMembersMock.mockImplementation(({ offset }: { offset?: number }) => {
      const off = offset ?? 0;
      if (off >= 30) return Promise.resolve([]);
      return Promise.resolve(makePage(off));
    });
    countMembersMock.mockResolvedValue(42);

    renderDirectoryPage();

    await waitFor(() => {
      expect(listMembersMock).toHaveBeenCalledTimes(3);
    });

    expect(listMembersMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ offset: 0, sort: 'recent' }));
    expect(listMembersMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ offset: 10, sort: 'recent' }));
    expect(listMembersMock).toHaveBeenNthCalledWith(3, expect.objectContaining({ offset: 20, sort: 'recent' }));
  });
});
