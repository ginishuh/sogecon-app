import { fireEvent, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { vi } from 'vitest';

import SignupPage from '../app/signup/page';
import { renderWithProviders } from '../tests/render-with-providers';

const showMock = vi.fn();
const createSignupRequestMock = vi.fn();

vi.mock('../components/toast', () => ({
  useToast: () => ({ show: showMock }),
}));

vi.mock('../services/signup-requests', () => ({
  createSignupRequest: (...args: unknown[]) => createSignupRequestMock(...args),
}));

describe('SignupPage', () => {
  beforeEach(() => {
    showMock.mockReset();
    createSignupRequestMock.mockReset();
  });

  it('접수 후에는 사무국 확인 단계와 기다릴 행동만 안내한다', async () => {
    createSignupRequestMock.mockResolvedValueOnce({
      id: 11,
      student_id: '20260001',
      status: 'pending',
    });
    renderWithProviders(<SignupPage />);

    fireEvent.change(screen.getByLabelText('학번'), { target: { value: '20260001' } });
    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '홍길동' } });
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'member@example.com' } });
    fireEvent.change(screen.getByLabelText('기수'), { target: { value: '58' } });
    fireEvent.change(screen.getByLabelText('연락처'), { target: { value: '01012345678' } });
    fireEvent.click(screen.getByRole('button', { name: '가입 정보 보내기' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '가입 신청 완료' })).toBeInTheDocument();
    });
    expect(screen.getByText('동문회 사무국 확인').closest('li')).toHaveAttribute(
      'aria-current',
      'step'
    );
    expect(screen.getByText(/안내를 받기 전에는 로그인하거나 비밀번호를 만들 수 없습니다/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '로그인으로 이동' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '첫 로그인 설정' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '홈으로 이동' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: '확인이 오래 걸리면 문의하기' })).toHaveAttribute(
      'href',
      '/support/contact'
    );
  });

  it('입력 변경 시 이벤트 객체 수명과 무관하게 값이 반영된다', () => {
    renderWithProviders(<SignupPage />);

    const studentIdInput = screen.getByLabelText('학번') as HTMLInputElement;
    const nameInput = screen.getByLabelText('이름') as HTMLInputElement;
    const emailInput = screen.getByLabelText('이메일') as HTMLInputElement;
    const cohortInput = screen.getByLabelText('기수') as HTMLInputElement;
    const noteInput = screen.getByLabelText('사무국에 전할 내용(선택)') as HTMLTextAreaElement;

    fireEvent.change(studentIdInput, { target: { value: '20260001' } });
    fireEvent.change(nameInput, { target: { value: '홍길동' } });
    fireEvent.change(emailInput, { target: { value: 'hong@example.com' } });
    fireEvent.change(cohortInput, { target: { value: '58' } });
    fireEvent.change(noteInput, { target: { value: '테스트 메모' } });

    expect(studentIdInput.value).toBe('20260001');
    expect(nameInput.value).toBe('홍길동');
    expect(emailInput.value).toBe('hong@example.com');
    expect(cohortInput.value).toBe('58');
    expect(noteInput.value).toBe('테스트 메모');
  });

  it('연락처 공백 입력 시 에러를 표시한다', () => {
    renderWithProviders(<SignupPage />);

    const studentIdInput = screen.getByLabelText('학번') as HTMLInputElement;
    const nameInput = screen.getByLabelText('이름') as HTMLInputElement;
    const emailInput = screen.getByLabelText('이메일') as HTMLInputElement;
    const cohortInput = screen.getByLabelText('기수') as HTMLInputElement;
    const phoneInput = screen.getByLabelText('연락처') as HTMLInputElement;

    fireEvent.change(studentIdInput, { target: { value: '20260001' } });
    fireEvent.change(nameInput, { target: { value: '홍길동' } });
    fireEvent.change(emailInput, { target: { value: 'hong@example.com' } });
    fireEvent.change(cohortInput, { target: { value: '58' } });
    fireEvent.change(phoneInput, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: '가입 정보 보내기' }));

    expect(screen.getByText('연락처를 입력해 주세요.')).toBeInTheDocument();
    expect(showMock).toHaveBeenCalledWith('연락처를 입력해 주세요.', { type: 'error' });
  });
});
