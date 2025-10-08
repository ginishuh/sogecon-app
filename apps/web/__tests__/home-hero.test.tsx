import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import HomePage from '../app/page';

describe('HomePage hero and cards', () => {
  it('renders hero title, description, and primary CTA', () => {
    const { asFragment } = render(<HomePage />);
    expect(screen.getByRole('heading', { name: '총원우회 활동을 한눈에, 어디서든 함께' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '다가오는 행사 보기' })).toHaveAttribute('href', '/events');
    expect(screen.getByText(/푸시 알림과 회원 전용 기능은 곧 이어집니다/)).toBeInTheDocument();
    expect(asFragment()).toMatchSnapshot();
  });

  it('renders quick access cards with metadata', () => {
    render(<HomePage />);
    const cards = screen.getAllByRole('link', { name: /·/ });
    expect(cards).toHaveLength(3);
    expect(screen.getByRole('link', { name: '공지 · 11월 운영위원회 요약' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '행사 · 2025 정기총회 & 홈커밍' })).toBeInTheDocument();
  });
});
