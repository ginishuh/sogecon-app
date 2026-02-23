import { fireEvent, screen } from '@testing-library/react';
import React from 'react';
import { vi } from 'vitest';

import SignupPage from '../app/signup/page';
import { renderWithProviders } from '../tests/render-with-providers';

const showMock = vi.fn();

vi.mock('../components/toast', () => ({
  useToast: () => ({ show: showMock }),
}));

describe('SignupPage', () => {
  beforeEach(() => {
    showMock.mockReset();
  });

  it('입력 변경 시 이벤트 객체 수명과 무관하게 값이 반영된다', () => {
    renderWithProviders(<SignupPage />);

    const studentIdInput = screen.getByLabelText('학번') as HTMLInputElement;
    const nameInput = screen.getByLabelText('이름') as HTMLInputElement;
    const emailInput = screen.getByLabelText('이메일') as HTMLInputElement;
    const cohortInput = screen.getByLabelText('기수') as HTMLInputElement;
    const noteInput = screen.getByLabelText('메모(선택)') as HTMLTextAreaElement;

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
});
