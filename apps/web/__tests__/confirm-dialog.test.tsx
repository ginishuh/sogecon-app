import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React, { useState } from 'react';
import { beforeAll, describe, expect, it } from 'vitest';

import { ConfirmDialog } from '../components/confirm-dialog';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
  };
});

function DialogHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        게시글 삭제 열기
      </button>
      <ConfirmDialog
        open={open}
        title="게시글 삭제"
        description="이 작업은 되돌릴 수 없습니다."
        confirmLabel="삭제"
        variant="danger"
        onConfirm={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

describe('ConfirmDialog', () => {
  it('이름과 설명을 연결하고 안전한 취소 동작에 초기 포커스를 둔다', async () => {
    render(<DialogHarness />);
    fireEvent.click(screen.getByRole('button', { name: '게시글 삭제 열기' }));

    const dialog = screen.getByRole('dialog', { name: '게시글 삭제' });
    expect(dialog).toHaveAccessibleDescription('이 작업은 되돌릴 수 없습니다.');
    expect(screen.getByRole('button', { name: '취소' })).toHaveFocus();
  });

  it('조작 버튼에 최소 44px 높이 계약을 적용한다', () => {
    render(<DialogHarness />);
    fireEvent.click(screen.getByRole('button', { name: '게시글 삭제 열기' }));

    expect(screen.getByRole('button', { name: '취소' })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: '삭제' })).toHaveClass('min-h-11');
  });

  it('Escape 취소 뒤 호출 버튼으로 포커스를 복원한다', async () => {
    render(<DialogHarness />);
    const opener = screen.getByRole('button', { name: '게시글 삭제 열기' });
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole('dialog', { name: '게시글 삭제' });
    fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }));

    await waitFor(() => expect(opener).toHaveFocus());
  });
});
