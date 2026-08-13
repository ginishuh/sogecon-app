import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MultiImageUpload } from '../components/multi-image-upload';

describe('다중 이미지 썸네일 액션', () => {
  it('hover 없이 삭제·메인 지정 버튼이 보이고 키보드로 도달한다', () => {
    const onCoverChange = vi.fn();
    const onImagesChange = vi.fn();

    render(
      <div style={{ width: 390 }}>
        <MultiImageUpload
          coverImage="/uploads/cover.webp"
          images={['/uploads/extra.webp']}
          onCoverChange={onCoverChange}
          onImagesChange={onImagesChange}
        />
      </div>,
    );

    const setMain = screen.getByRole('button', { name: '메인 이미지로 지정' });
    const removeButtons = screen.getAllByRole('button', { name: '이미지 삭제' });
    expect(setMain).toBeVisible();
    expect(removeButtons).toHaveLength(2);
    expect(setMain).toHaveClass('min-h-11');
    expect(removeButtons[0]).toHaveClass('min-h-11');

    setMain.focus();
    expect(setMain).toHaveFocus();
    fireEvent.click(setMain);
    expect(onCoverChange).toHaveBeenCalledWith('/uploads/extra.webp');
  });
});
