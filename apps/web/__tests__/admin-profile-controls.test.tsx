import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  RejectPanel,
  RowActions,
} from '../app/admin/profile-change-requests/page';
import { SaveRoleButton } from '../app/admin/members/member-parts';
import { RoleChecklist } from '../app/admin/members/role-shared';
import type { ProfileChangeRequestRead } from '../services/profile-change-requests';

const request: ProfileChangeRequestRead = {
  id: 7,
  member_id: 11,
  member_name: '합성 회원',
  member_student_id: 'e2e-test',
  field_name: 'name',
  old_value: '기존 이름',
  new_value: '새 이름',
  status: 'pending',
  reject_reason: null,
  requested_at: '2026-07-14T00:00:00Z',
  decided_at: null,
  decided_by_student_id: null,
};

describe('관리자 프로필 변경 심사 접근성', () => {
  it('반려 사유를 visible label과 연결하고 모든 동작에 44px 계약을 둔다', () => {
    render(
      <RejectPanel
        target={request}
        reason=""
        pending={false}
        onReasonChange={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('textbox', { name: '반려 사유' })).toHaveAttribute(
      'id',
      'profile-change-reject-reason-7',
    );
    expect(screen.getByRole('button', { name: '반려 확인' })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: '취소' })).toHaveClass('min-h-11');
  });

  it('승인과 반려 버튼에 44px 및 focus-visible 계약을 적용한다', () => {
    render(
      <RowActions
        row={request}
        approving={false}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    for (const name of ['승인', '반려']) {
      const button = screen.getByRole('button', { name });
      expect(button).toHaveClass('min-h-11');
      expect(button).toHaveClass('focus-visible:ring-2');
    }
  });
});

describe('회원 역할 관리 접근성', () => {
  it('역할 label 전체를 44px hit area로 제공하고 checkbox에 focus ring을 둔다', () => {
    const onToggle = vi.fn();
    render(
      <RoleChecklist
        id="member-1"
        draftRoles={['member', 'admin', 'admin_posts']}
        disabled={false}
        onToggle={onToggle}
      />,
    );

    const checkbox = screen.getByRole('checkbox', { name: '프로필 변경 심사' });
    expect(checkbox.closest('label')).toHaveClass('min-h-11');
    expect(checkbox).toHaveClass('focus-visible:ring-2');

    fireEvent.click(checkbox);
    expect(onToggle).toHaveBeenCalledWith('member-1', 'admin_profile', true);
  });

  it('역할 저장 버튼에 44px 및 focus-visible 계약을 적용한다', () => {
    render(<SaveRoleButton disabled={false} onClick={vi.fn()} />);

    const button = screen.getByRole('button', { name: '저장' });
    expect(button).toHaveClass('min-h-11');
    expect(button).toHaveClass('focus-visible:ring-2');
  });
});
