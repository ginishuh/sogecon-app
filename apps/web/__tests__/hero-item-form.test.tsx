import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { vi } from 'vitest';

import { HeroItemForm } from '../components/hero-item-form';

vi.mock('../components/image-upload', () => ({
  ImageUpload: () => <div data-testid="image-upload-mock" />,
}));

describe('HeroItemForm', () => {
  it('입력 변경 후 제출 시 최신 폼 값으로 payload를 생성한다', () => {
    const onSubmit = vi.fn();
    render(<HeroItemForm onSubmit={(payload) => onSubmit(payload)} />);

    const targetTypeSelect = screen.getByLabelText('대상 종류') as HTMLSelectElement;
    const targetIdInput = screen.getByPlaceholderText('예: 123') as HTMLInputElement;
    const enabledCheckbox = screen.getByLabelText('홈 배너 노출') as HTMLInputElement;
    const pinnedCheckbox = screen.getByLabelText('홈 배너 상단 고정') as HTMLInputElement;
    const titleInput = screen.getByLabelText('제목(옵션)') as HTMLInputElement;
    const descriptionInput = screen.getByLabelText('설명(옵션)') as HTMLTextAreaElement;

    fireEvent.change(targetTypeSelect, { target: { value: 'event' } });
    fireEvent.change(targetIdInput, { target: { value: '42' } });
    fireEvent.click(enabledCheckbox);
    fireEvent.click(pinnedCheckbox);
    fireEvent.change(titleInput, { target: { value: '  테스트 제목  ' } });
    fireEvent.change(descriptionInput, { target: { value: '  테스트 설명  ' } });

    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      target_type: 'event',
      target_id: 42,
      enabled: false,
      pinned: true,
      title_override: '테스트 제목',
      description_override: '테스트 설명',
      image_override: null,
    });
  });

  it('주요 폼 조작에 44px hit area와 focus 표시 계약을 적용한다', () => {
    render(<HeroItemForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByLabelText('대상 종류')).toHaveClass('min-h-11');
    expect(screen.getByPlaceholderText('예: 123')).toHaveClass('min-h-11');
    expect(screen.getByLabelText('제목(옵션)')).toHaveClass('min-h-11');
    expect(screen.getByLabelText('설명(옵션)')).toHaveClass('min-h-24');

    const enabledCheckbox = screen.getByLabelText('홈 배너 노출');
    const pinnedCheckbox = screen.getByLabelText('홈 배너 상단 고정');
    expect(enabledCheckbox.closest('label')).toHaveClass('min-h-11');
    expect(pinnedCheckbox.closest('label')).toHaveClass('min-h-11');
    expect(enabledCheckbox).toHaveClass('focus-visible:ring-2');
    expect(pinnedCheckbox).toHaveClass('focus-visible:ring-2');

    expect(screen.getByRole('button', { name: '취소' })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: '저장' })).toHaveClass('min-h-11');
  });
});
