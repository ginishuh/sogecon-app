import { screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import HomePage from '../app/page';
import { renderWithProviders } from '../tests/render-with-providers';

describe('HomePage hero and cards', () => {
  it('renders hero section with sr-only heading', () => {
    renderWithProviders(<HomePage />);
    // sr-only h1 확인
    expect(screen.getByRole('heading', { name: '서강대 경제대학원 총동문회' })).toBeInTheDocument();
  });

  it('renders quick action links with correct aria labels', () => {
    renderWithProviders(<HomePage />);
    // 퀵 액션 링크들 확인
    expect(screen.getByRole('link', { name: '총동문회 소개 바로가기' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '동문 수첩 바로가기' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '행사 일정 바로가기' })).toBeInTheDocument();
  });
});
