import { fireEvent, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { vi } from 'vitest';

import SignupPage from '../app/signup/page';
import { ApiError } from '../lib/api';
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
    expect(phoneInput).toHaveFocus();
    expect(phoneInput).toHaveAttribute('aria-invalid', 'true');
    expect(showMock).not.toHaveBeenCalled();
  });

  it('숫자가 아닌 기수는 해당 입력에 연결된 오류와 포커스를 제공한다', () => {
    renderWithProviders(<SignupPage />);

    const cohortInput = screen.getByLabelText('기수') as HTMLInputElement;
    fireEvent.change(screen.getByLabelText('학번'), { target: { value: '20260001' } });
    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '홍길동' } });
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'hong@example.com' } });
    fireEvent.change(cohortInput, { target: { value: '58abc' } });
    fireEvent.change(screen.getByLabelText('연락처'), { target: { value: '01012345678' } });
    fireEvent.click(screen.getByRole('button', { name: '가입 정보 보내기' }));

    expect(screen.getByText('기수를 숫자로 입력해 주세요.')).toBeInTheDocument();
    expect(cohortInput).toHaveFocus();
    expect(cohortInput).toHaveAttribute('aria-invalid', 'true');
  });

  it('API 오류 banner로 포커스를 옮겨 긴 폼에서도 안내를 놓치지 않게 한다', async () => {
    createSignupRequestMock.mockRejectedValueOnce(
      new ApiError(409, 'signup_already_pending', 'signup_already_pending')
    );
    renderWithProviders(<SignupPage />);

    fireEvent.change(screen.getByLabelText('학번'), { target: { value: '20260001' } });
    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '홍길동' } });
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'hong@example.com' } });
    fireEvent.change(screen.getByLabelText('기수'), { target: { value: '58' } });
    fireEvent.change(screen.getByLabelText('연락처'), { target: { value: '01012345678' } });
    fireEvent.click(screen.getByRole('button', { name: '가입 정보 보내기' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveFocus();
    expect(showMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('기수'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: '가입 정보 보내기' }));
    expect(alert).not.toBeInTheDocument();
    expect(screen.getByText('기수를 숫자로 입력해 주세요.')).toBeInTheDocument();
  });

  it('서버 검증기 원문 대신 입력 형식을 확인할 한국어 안내를 제공한다', async () => {
    createSignupRequestMock.mockRejectedValueOnce(
      new ApiError(
        422,
        'value is not a valid email address: The part after the @-sign is a special-use or reserved name',
      ),
    );
    renderWithProviders(<SignupPage />);

    fireEvent.change(screen.getByLabelText('학번'), { target: { value: 'e2esignup240714' } });
    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '합성 가입신청' } });
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'e2e@example.invalid' } });
    fireEvent.change(screen.getByLabelText('기수'), { target: { value: '177' } });
    fireEvent.change(screen.getByLabelText('연락처'), { target: { value: '01024071400' } });
    fireEvent.click(screen.getByRole('button', { name: '가입 정보 보내기' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '입력한 정보를 확인해 주세요. 이메일과 연락처 형식이 올바른지 확인해 주세요.',
    );
    expect(screen.queryByText(/valid email address/i)).not.toBeInTheDocument();
  });

  it('긴 가입 폼을 동문 확인 정보와 연락받을 정보로 나눈다', () => {
    renderWithProviders(<SignupPage />);

    expect(screen.getByRole('heading', { name: '가입 신청은 이렇게 진행돼요' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '동문 확인 정보' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '연락받을 정보' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '이미 가입했어요' })).toHaveAttribute('href', '/login');
    const optionalNote = screen.getByText('사무국에 전할 내용이 있나요? (선택)').closest('details');
    expect(optionalNote).not.toHaveAttribute('open');
    expect(optionalNote?.querySelector('summary')).toHaveClass('min-h-11');
  });
});
