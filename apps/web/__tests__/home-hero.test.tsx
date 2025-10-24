import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import HomePage from '../app/page';

describe('HomePage hero and cards', () => {
  it('renders hero title, description, and primary CTA', () => {
    const { asFragment } = render(<HomePage />);
    expect(screen.getByRole('heading', { name: '한 번의 로그인으로 동문 네트워크 전체를' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '동문 수첩 열기' })).toHaveAttribute('href', '/directory');
    expect(screen.getByText(/2025년 4분기부터는 푸시 알림과 회원 전용 기능을 순차적으로 공개합니다/)).toBeInTheDocument();
    expect(asFragment()).toMatchSnapshot();
  });

  it('renders quick access cards with metadata', () => {
    render(<HomePage />);
    const cards = screen.getAllByRole('link', { name: /·/ });
    expect(cards).toHaveLength(3);
    expect(screen.getByRole('link', { name: '수첩 · 동문 수첩 베타 공개' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '가이드 · 웹 런치 FAQ 12선' })).toBeInTheDocument();
  });
});
