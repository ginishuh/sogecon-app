import { screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import HomePage from '../app/page';
import { renderWithProviders } from '../tests/render-with-providers';

describe('HomePage hero and cards', () => {
  it('renders hero carousel with dots and caption', () => {
    renderWithProviders(<HomePage />);
    expect(screen.getByRole('heading', { name: '서강대 경제대학원 총동문회' })).toBeInTheDocument();
    // 슬라이드 캡션 2종 존재 확인
    const captions = screen.getAllByText(/공지 · 행사 · 동문 수첩을 한 곳에서|총동문회 웹 런치/);
    expect(captions).toHaveLength(2);
    // 도트 영역 존재(폴백 1~2개 중 하나 이상)
    const dots = document.querySelectorAll('.hero-dot');
    expect(dots.length).toBeGreaterThan(0);
  });

  it('renders quick access cards with metadata and about promo card', () => {
    renderWithProviders(<HomePage />);
    const cards = screen.getAllByRole('link', { name: /·/ });
    expect(cards.length).toBeGreaterThanOrEqual(3);
    expect(screen.getByRole('link', { name: '동문 수첩 · 동문 수첩 베타 공개' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '가이드 · 웹 런치 FAQ 12선' })).toBeInTheDocument();
    // About promo card exists
    expect(screen.getByRole('link', { name: '총동문회 소개 · 인사말·연혁·조직' })).toBeInTheDocument();
  });
});
