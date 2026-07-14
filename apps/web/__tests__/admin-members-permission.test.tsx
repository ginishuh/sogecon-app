import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminMembersPage from '../app/admin/members/page';
import AdminMemberDetailPage from '../app/admin/members/[id]/page';
import { MembersBody } from '../app/admin/members/members-table';
import { ToastProvider } from '../components/toast';
import {
  countMembersForAdmin,
  getMemberForAdmin,
  listMembersForAdmin,
  type MemberRead,
} from '../services/admin-members';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '21' }),
}));

let authRoles = ['member', 'admin', 'admin_posts'];

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    status: 'authorized',
    data: { roles: authRoles },
  }),
}));

vi.mock('../services/admin-members', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services/admin-members')>();
  return {
    ...original,
    countMembersForAdmin: vi.fn(),
    getMemberForAdmin: vi.fn(),
    listMembersForAdmin: vi.fn(),
  };
});

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

describe('회원 관리자 페이지 권한 경계', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authRoles = ['member', 'admin', 'admin_posts'];
  });

  it('admin_roles 권한이 없으면 회원 목록과 개수 API를 요청하지 않는다', async () => {
    render(<AdminMembersPage />, { wrapper: Providers });

    expect(await screen.findByText('해당 화면 접근 권한이 없습니다.')).toBeInTheDocument();
    expect(listMembersForAdmin).not.toHaveBeenCalled();
    expect(countMembersForAdmin).not.toHaveBeenCalled();
  });

  it('조회 전용 목록 조작에 44px hit area와 접근 가능한 이름을 제공한다', async () => {
    authRoles = ['member', 'admin', 'admin_posts', 'admin_roles'];
    vi.mocked(listMembersForAdmin).mockResolvedValue([]);
    vi.mocked(countMembersForAdmin).mockResolvedValue(0);

    render(<AdminMembersPage />, { wrapper: Providers });

    expect(await screen.findByText('조건에 맞는 회원이 없습니다.')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: '회원 검색' })).toHaveClass('min-h-11');
    expect(screen.getByRole('combobox', { name: '정렬 기준' })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: '이전' })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: '다음' })).toHaveClass('min-h-11');
    expect(screen.queryByText('admin_roles')).not.toBeInTheDocument();
    expect(screen.queryByText('super_admin')).not.toBeInTheDocument();
  });

  it('회원 상세 진입 링크에 44px hit area를 제공한다', () => {
    const member: MemberRead = {
      id: 21,
      student_id: 'synthetic-member',
      email: 'synthetic@example.com',
      name: '합성 회원',
      cohort: 177,
      roles: 'member,admin,admin_posts,admin_roles',
      visibility: 'all',
      status: 'active',
      avatar_url: null,
    };

    render(
      <MembersBody
        rows={[member]}
        drafts={{ 21: ['member', 'admin', 'admin_posts', 'admin_roles'] }}
        isSuperAdmin={false}
        isPending={false}
        isLoading={false}
        isError={false}
        onToggle={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    for (const link of screen.getAllByRole('link', { name: 'synthetic-member' })) {
      expect(link).toHaveClass('min-h-11');
      expect(link).toHaveClass('focus-visible:ring-2');
    }
    expect(screen.getAllByText('177기 · 활성')).toHaveLength(2);
    expect(screen.queryByText(/177기 · active/)).not.toBeInTheDocument();
  });

  it('조회 전용 회원 상세의 상태를 사용자 언어로 표시한다', async () => {
    authRoles = ['member', 'admin', 'admin_posts', 'admin_roles'];
    vi.mocked(getMemberForAdmin).mockResolvedValue({
      id: 21,
      student_id: 'synthetic-member',
      email: 'synthetic@example.com',
      name: '합성 회원',
      cohort: 177,
      roles: 'member,admin,admin_posts,admin_roles',
      visibility: 'all',
      status: 'active',
      avatar_url: null,
    });

    render(<AdminMemberDetailPage />, { wrapper: Providers });

    expect(await screen.findByText('177기 · 활성')).toBeInTheDocument();
    expect(screen.getByText('활성')).toBeInTheDocument();
    expect(screen.queryByText('active')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /회원 목록/ })).toHaveClass('min-h-11');
  });
});
