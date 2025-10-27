import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import HomePage from '../app/page';

describe('HomePage hero and cards', () => {
  it('renders hero carousel with dots and caption', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { name: '서강대 경제대학원 총동문회' })).toBeInTheDocument();
    // 캡션 바 존재
    expect(screen.getByText(/공지 · 행사 · 동문 수첩을 한 곳에서|총동문회 웹 런치/)).toBeInTheDocument();
    // 도트 영역 존재(폴백 1~2개 중 하나 이상)
    const dots = document.querySelectorAll('.hero-dot');
    expect(dots.length).toBeGreaterThan(0);
  });

  it('renders quick access cards with metadata and about promo card', () => {
    render(<HomePage />);
    const cards = screen.getAllByRole('link', { name: /·/ });
    expect(cards).toHaveLength(3);
    expect(screen.getByRole('link', { name: '동문 수첩 · 동문 수첩 베타 공개' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '가이드 · 웹 런치 FAQ 12선' })).toBeInTheDocument();
    // About promo card exists
    expect(screen.getByRole('link', { name: '총동문회 소개 · 인사말·연혁·조직' })).toBeInTheDocument();
  });
});
