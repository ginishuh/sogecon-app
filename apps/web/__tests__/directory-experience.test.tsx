import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import DirectoryCard from '../components/directory-card';
import MemberDetailModal from '../components/member-detail-modal';
import type { Member } from '../services/members';

const member: Member = {
  id: 177,
  email: 'e2e177@example.com',
  name: 'E2E 테스트 회원',
  cohort: 177,
  major: null,
  company: null,
  industry: null,
  roles: 'member',
  visibility: 'all',
  phone: '01000000177',
};

describe('동문 수첩 회원 경험', () => {
  it('모바일·태블릿 카드가 핵심 회원 정보와 하나의 공개 안내를 제공한다', () => {
    const onClick = vi.fn();
    render(<DirectoryCard member={member} onClick={onClick} />);

    expect(screen.getByRole('button', { name: 'E2E 테스트 회원 상세 정보 보기' })).toBeInTheDocument();
    expect(screen.getByText('177기')).toBeInTheDocument();
    expect(screen.getByText('소속 정보 비공개')).toBeInTheDocument();
    expect(screen.getByText('모든 동문에게 공개')).toBeInTheDocument();
    expect(screen.queryByText('공개하지 않음')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'E2E 테스트 회원 상세 정보 보기' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('상세 모달이 프로필·연락처·공개 범위를 구분하고 Escape로 닫힌다', () => {
    const onClose = vi.fn();
    render(<MemberDetailModal member={member} open onClose={onClose} />);

    expect(screen.getByRole('dialog', { name: '회원 정보' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '연락처' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '공개 범위' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '닫기' })).toHaveClass('min-h-11', 'min-w-11');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
