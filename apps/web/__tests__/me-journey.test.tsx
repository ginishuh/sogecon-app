import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { vi } from 'vitest';

import MePage from '../app/me/page';

const getMeMock = vi.fn();
const updateMeMock = vi.fn();
const showToastMock = vi.fn();
const retryAuthMock = vi.fn();
const toastValue = { show: showToastMock };
let authStatus: 'authorized' | 'error' = 'authorized';

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ status: authStatus, invalidate: retryAuthMock }) }));
vi.mock('../components/toast', () => ({ useToast: () => toastValue }));
vi.mock('../app/me/change-request', () => ({ ChangeRequestSection: () => <section>기본 정보 변경 요청</section> }));
vi.mock('../services/me', () => ({
  API_BASE: 'http://localhost:3001',
  getMe: (...args: unknown[]) => getMeMock(...args),
  updateMe: (...args: unknown[]) => updateMeMock(...args),
  updateAvatar: vi.fn(),
}));

const member = {
  id: 9,
  student_id: 'e2e215',
  email: 'member@example.com',
  name: '서강 동문',
  cohort: 61,
  roles: 'member',
  visibility: 'all' as const,
  major: '경제학',
  birth_date: null,
  birth_lunar: false,
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

describe('내 정보 공개 범위 여정', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStatus = 'authorized';
    getMeMock.mockResolvedValue(member);
    updateMeMock.mockImplementation(async (payload) => ({ ...member, ...payload }));
  });

  it('변경 여부와 공개 영향을 안내하고 저장 완료 상태를 남긴다', async () => {
    render(<MePage />);

    expect(await screen.findByRole('heading', { name: '내 정보와 공개 범위' })).toBeInTheDocument();
    expect(screen.getByText('저장된 상태예요')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '동문에게 이렇게 보여요' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '저장된 상태입니다' })).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: '나만 보기' }));
    expect(screen.getByRole('radio', { name: '나만 보기' }).closest('label')).toHaveClass('focus-within:ring-2');
    expect(screen.getByText('현재 선택: 나만 보기')).toBeInTheDocument();
    expect(screen.getByText('저장하지 않은 변경사항이 있어요')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장하기' }));
    await waitFor(() => expect(updateMeMock).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'private' })));
    expect(await screen.findByText('변경사항을 저장했습니다. 동문 수첩에는 선택한 공개 범위에 따라 표시됩니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '저장된 상태입니다' })).toBeDisabled();
  });

  it('연락처와 소속 편집을 접힌 요약에서 필요한 영역만 연다', async () => {
    render(<MePage />);

    await screen.findByRole('heading', { name: '내 정보와 공개 범위' });
    const contact = screen.getByRole('button', { name: /연락처 정보/ });
    const organization = screen.getByRole('button', { name: /소속 정보/ });
    expect(contact).toHaveAttribute('aria-expanded', 'false');
    expect(organization).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('휴대전화(선택)')).not.toBeVisible();

    fireEvent.click(contact);
    expect(contact).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('휴대전화(선택)')).toBeVisible();

    fireEvent.click(organization);
    expect(contact).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByLabelText('휴대전화(선택)')).not.toBeVisible();
    expect(organization).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('회사명(선택)')).toBeVisible();
  });

  it('검증 오류가 있는 편집 영역을 다시 열어 수정할 필드를 보여준다', async () => {
    render(<MePage />);

    await screen.findByRole('heading', { name: '내 정보와 공개 범위' });
    const contact = screen.getByRole('button', { name: /연락처 정보/ });
    fireEvent.click(contact);
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'invalid-email' } });
    fireEvent.click(contact);
    expect(contact).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장하기' }));
    await waitFor(() => expect(contact).toHaveAttribute('aria-expanded', 'true'));
    expect(screen.getByLabelText('이메일')).toBeVisible();
    expect(updateMeMock).not.toHaveBeenCalled();
  });

  it('모바일 사진 변경 버튼이 활성 DOM의 file input을 연다', async () => {
    const inputClick = vi.spyOn(HTMLInputElement.prototype, 'click');
    render(<MePage />);

    await screen.findByRole('heading', { name: '내 정보와 공개 범위' });
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).toHaveClass('sr-only');
    expect(fileInput?.closest('.hidden')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '프로필 사진 변경' }));
    expect(inputClick).toHaveBeenCalledTimes(1);
    inputClick.mockRestore();
  });

  it('로그인 상태 조회 실패를 무한 로딩 대신 재시도 상태로 보여준다', () => {
    authStatus = 'error';
    render(<MePage />);

    expect(screen.getByRole('alert')).toHaveTextContent('로그인 상태를 확인하지 못했습니다.');
    fireEvent.click(screen.getByRole('button', { name: '다시 확인하기' }));
    expect(retryAuthMock).toHaveBeenCalledTimes(1);
  });
});
