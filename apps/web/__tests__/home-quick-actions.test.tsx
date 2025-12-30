import { screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import HomePage from '../app/page';
import { renderWithProviders } from '../tests/render-with-providers';

describe('Home Quick Actions', () => {
  it('renders six quick actions with correct routes', () => {
    renderWithProviders(<HomePage />);
    // 헤더는 sr-only이므로 시각적 존재 대신 링크 6개와 경로를 검증
    expect(screen.getByRole('link', { name: '총동문회 소개 바로가기' })).toHaveAttribute('href', '/about/greeting');
    expect(screen.getByRole('link', { name: '동문 수첩 바로가기' })).toHaveAttribute('href', '/directory');
    expect(screen.getByRole('link', { name: '행사 일정 바로가기' })).toHaveAttribute('href', '/events');
    expect(screen.getByRole('link', { name: '총동문회 소식 바로가기' })).toHaveAttribute('href', '/posts');
    expect(screen.getByRole('link', { name: '자유게시판 바로가기' })).toHaveAttribute('href', '/board?tab=discussion');
    expect(screen.getByRole('link', { name: '경조사 게시판 바로가기' })).toHaveAttribute('href', '/board?tab=congrats');
  });

  it('includes greeting preview card', () => {
    renderWithProviders(<HomePage />);
    // Check greeting call-to-action
    expect(screen.getByRole('link', { name: '총동문회장 인사말' })).toHaveAttribute('href', '/about/greeting');
    expect(screen.getByRole('link', { name: '대학원장 인사말' })).toHaveAttribute('href', '/about/dean-greeting');
  });
});
