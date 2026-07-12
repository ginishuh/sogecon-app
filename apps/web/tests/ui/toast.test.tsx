import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { ToastProvider, useToast } from '../../components/toast';

function Fixture() {
  const toast = useToast();
  return (
    <>
      <button onClick={() => toast.show('저장되었습니다.', { type: 'success' })}>성공</button>
      <button onClick={() => toast.show('저장하지 못했습니다.', { type: 'error' })}>오류</button>
    </>
  );
}

describe('Toast', () => {
  it('announces normal messages politely and errors assertively', () => {
    render(<ToastProvider><Fixture /></ToastProvider>);
    fireEvent.click(screen.getByRole('button', { name: '성공' }));
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    fireEvent.click(screen.getByRole('button', { name: '오류' }));
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
  });
});
