import { screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import HomePage from '../app/page';
import { HomeActionsView } from '../components/home/quick-actions';
import { renderWithProviders } from '../tests/render-with-providers';

describe('HomePage hero and cards', () => {
  it('renders hero section with sr-only heading', () => {
    renderWithProviders(<HomePage />);
    // sr-only h1 확인
    expect(screen.getByRole('heading', { name: '서강대 경제대학원 총동문회' })).toBeInTheDocument();
  });

  it('renders the guest journey without duplicated menu tiles', () => {
    renderWithProviders(<HomeActionsView status="unauthorized" isAdmin={false} />);
    expect(screen.getByRole('link', { name: /동문 가입 신청/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /동문 로그인/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /비밀번호 만들기/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /행사 일정 바로가기/ })).not.toBeInTheDocument();
  });
});
