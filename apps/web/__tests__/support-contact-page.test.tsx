import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SupportContactPage from '../app/support/contact/page';
import { ApiError } from '../lib/api';

const showMock = vi.fn();
const submitContactMock = vi.fn();

vi.mock('../components/toast', () => ({
  useToast: () => ({ show: showMock }),
}));

vi.mock('../services/support', () => ({
  submitContact: (...args: unknown[]) => submitContactMock(...args),
}));

describe('사무국 문의 화면', () => {
  beforeEach(() => {
    showMock.mockReset();
    submitContactMock.mockReset();
  });

  it('답변 연락처를 이메일로 명확히 받고 기존 API 필드로 전달한다', async () => {
    submitContactMock.mockResolvedValueOnce(undefined);
    render(<SupportContactPage />);

    const subject = screen.getByLabelText('제목');
    const body = screen.getByLabelText('내용');
    const email = screen.getByLabelText('답변받을 이메일');
    expect(subject).toBeRequired();
    expect(subject).toHaveAttribute('minlength', '3');
    expect(subject).toHaveAccessibleDescription('3자 이상 입력해 주세요.');
    expect(body).toBeRequired();
    expect(body).toHaveAttribute('minlength', '10');
    expect(body).toHaveAccessibleDescription('10자 이상 입력해 주세요.');
    expect(email).toHaveAttribute('type', 'email');
    expect(email).toBeRequired();
    expect(email).toHaveAttribute('autocomplete', 'email');
    expect(email).toHaveAttribute('placeholder', 'name@example.com');
    expect(email).toHaveAccessibleDescription('답변받을 수 있는 이메일을 입력해 주세요.');

    fireEvent.change(subject, {
      target: { value: '홈페이지 이용 문의' },
    });
    fireEvent.change(body, {
      target: { value: '홈페이지 이용 방법을 문의드립니다.' },
    });
    fireEvent.change(email, { target: { value: 'member@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: '보내기' }));

    await waitFor(() => {
      expect(submitContactMock).toHaveBeenCalledWith({
        subject: '홈페이지 이용 문의',
        body: '홈페이지 이용 방법을 문의드립니다.',
        contact: 'member@example.com',
      });
    });
  });

  it('입력 오류를 한국어로 안내하고 첫 오류 항목으로 이동한다', () => {
    render(<SupportContactPage />);

    fireEvent.click(screen.getByRole('button', { name: '보내기' }));

    const subject = screen.getByLabelText('제목');
    expect(screen.getByText('문의 제목을 입력해 주세요.')).toHaveAttribute('role', 'alert');
    expect(screen.getByText('문의 내용을 입력해 주세요.')).toHaveAttribute('role', 'alert');
    expect(screen.getByText('답변받을 이메일을 입력해 주세요.')).toHaveAttribute('role', 'alert');
    expect(subject).toHaveFocus();
    expect(subject).toHaveAttribute('aria-invalid', 'true');
    expect(submitContactMock).not.toHaveBeenCalled();

    fireEvent.change(subject, { target: { value: '문의 제목' } });
    fireEvent.change(screen.getByLabelText('내용'), {
      target: { value: '문의 내용은 충분히 길게 입력합니다.' },
    });
    const email = screen.getByLabelText('답변받을 이메일');
    fireEvent.change(email, { target: { value: '010-1234-5678' } });
    fireEvent.click(screen.getByRole('button', { name: '보내기' }));

    expect(screen.getByText('이메일 형식을 확인해 주세요. 예: name@example.com')).toHaveAttribute('role', 'alert');
    expect(email).toHaveFocus();
    expect(submitContactMock).not.toHaveBeenCalled();
  });

  it('연속 접수 제한은 기다릴 시간을 구체적으로 안내한다', async () => {
    submitContactMock.mockRejectedValueOnce(new ApiError(429, 'rate limited'));
    render(<SupportContactPage />);

    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '문의 제목' } });
    fireEvent.change(screen.getByLabelText('내용'), {
      target: { value: '문의 내용은 충분히 길게 입력합니다.' },
    });
    fireEvent.change(screen.getByLabelText('답변받을 이메일'), {
      target: { value: 'member@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: '보내기' }));

    const message = '문의가 연속으로 접수되었습니다. 1분 후 다시 보내 주세요.';
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(showMock).toHaveBeenCalledWith(message, { type: 'error' });
  });
});
