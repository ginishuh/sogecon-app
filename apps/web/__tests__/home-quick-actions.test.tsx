import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import HomePage from '../app/page';

describe('Home Quick Actions', () => {
  it('renders six quick actions with correct routes', () => {
    render(<HomePage />);
    // 헤더는 sr-only이므로 시각적 존재 대신 링크 6개와 경로를 검증
    expect(screen.getByRole('link', { name: '총동문회 소개 바로가기' })).toHaveAttribute('href', '/about/greeting');
    expect(screen.getByRole('link', { name: '총동문회 수첩 바로가기' })).toHaveAttribute('href', '/directory');
    expect(screen.getByRole('link', { name: '총동문회 행사 바로가기' })).toHaveAttribute('href', '/events');
    expect(screen.getByRole('link', { name: '총동문회 소식 바로가기' })).toHaveAttribute('href', '/posts');
    expect(screen.getByRole('link', { name: '자유게시판 바로가기' })).toHaveAttribute('href', '/board?tab=discussion');
    expect(screen.getByRole('link', { name: '경조사 게시판 바로가기' })).toHaveAttribute('href', '/board?tab=congrats');
  });

  it('includes greeting preview card and stats at the end', () => {
    const { container } = render(<HomePage />);
    // Check greeting call-to-action
    expect(screen.getByRole('heading', { name: '회장 인사말' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '전문 보기' })).toHaveAttribute('href', '/about/greeting');

    // Stats section landmark
    const statsHeading = screen.getByRole('heading', { name: '2025년 4분기 준비 현황' });
    expect(statsHeading).toBeInTheDocument();
    expect(container.textContent).toContain('등록 회원');
  });
});
