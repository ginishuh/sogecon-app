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
});
