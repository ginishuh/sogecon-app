import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import HomePage from '../app/page';

describe('Home Quick Actions', () => {
  it('renders four quick actions with correct routes', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { name: '빠른 실행' })).toBeInTheDocument();

    const directory = screen.getByRole('link', { name: '동문 수첩 바로가기' });
    expect(directory).toHaveAttribute('href', '/directory');

    const events = screen.getByRole('link', { name: '행사 바로가기' });
    expect(events).toHaveAttribute('href', '/events');

    const posts = screen.getByRole('link', { name: '총동문회 소식 바로가기' });
    expect(posts).toHaveAttribute('href', '/posts');

    const board = screen.getByRole('link', { name: '커뮤니티 게시판 바로가기' });
    expect(board).toHaveAttribute('href', '/board');
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

