import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import AdminSignupRequestsPage from '../app/admin/signup-requests/page';
import {
  FiltersPanel,
  PaginationBar,
  RejectPanel,
  SignupRequestsTable,
} from '../app/admin/signup-requests/view';
import type { SignupRequestRead } from '../services/signup-requests';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ status: 'loading', data: undefined }),
}));

const request: SignupRequestRead = {
  id: 17,
  student_id: 'e2e-signup',
  email: 'e2e-signup@example.com',
  name: '합성 가입신청',
  cohort: 177,
  major: '경제',
  phone: '01000000000',
  note: null,
  status: 'pending',
  requested_at: '2026-07-14T00:00:00Z',
  decided_at: null,
  activated_at: null,
  decided_by_student_id: null,
  reject_reason: null,
};

describe('가입신청 심사 화면 상태', () => {
  it('인증 확인 중에는 비인증 문구 대신 확인 중 문구를 표시한다', () => {
    render(<AdminSignupRequestsPage />);

    expect(screen.getByText('관리자 권한을 확인하고 있습니다.')).toBeInTheDocument();
    expect(screen.queryByText('관리자 로그인이 필요합니다.')).not.toBeInTheDocument();
  });

  it('raw 상태값 대신 한국어 상태를 표시하고 action에 44px focus 계약을 둔다', () => {
    render(
      <SignupRequestsTable
        state="ready"
        items={[request]}
        isApprovePending={false}
        isReissuePending={false}
        isRejectPending={false}
        onApprove={vi.fn()}
        onReissue={vi.fn()}
        onStartReject={vi.fn()}
      />,
    );

    expect(screen.queryByText('pending')).not.toBeInTheDocument();
    expect(screen.getAllByText('대기')).toHaveLength(2);
    for (const name of ['승인', '재발급', '반려']) {
      for (const button of screen.getAllByRole('button', { name })) {
        expect(button).toHaveClass('min-h-11');
        expect(button).toHaveClass('focus-visible:ring-2');
      }
    }
  });
});

describe('가입신청 심사 조작 접근성', () => {
  it('검색과 상태 필터를 visible label에 연결하고 조회 버튼을 44px로 제공한다', () => {
    render(
      <FiltersPanel
        searchInput=""
        statusFilter="all"
        onSearchInput={vi.fn()}
        onStatusFilter={vi.fn()}
        onSearch={vi.fn()}
      />,
    );

    expect(screen.getByRole('searchbox', { name: '검색' })).toHaveClass('min-h-11');
    expect(screen.getByRole('combobox', { name: '상태' })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: '조회' })).toHaveClass('min-h-11');
  });

  it('반려 사유를 visible label에 연결하고 확인과 취소를 44px로 제공한다', () => {
    render(
      <RejectPanel
        target={request}
        reason=""
        isPending={false}
        onReason={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('textbox', { name: '반려 사유' })).toHaveAttribute(
      'id',
      'signup-request-reject-reason-17',
    );
    expect(screen.getByRole('button', { name: '반려 확정' })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: '취소' })).toHaveClass('min-h-11');
  });

  it('페이지 이동 버튼을 44px로 제공하고 비활성 상태를 유지한다', () => {
    render(
      <PaginationBar
        page={0}
        total={1}
        totalPages={1}
        isFetching={false}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    for (const name of ['이전', '다음']) {
      const button = screen.getByRole('button', { name });
      expect(button).toHaveClass('min-h-11');
      expect(button).toBeDisabled();
    }
  });
});
