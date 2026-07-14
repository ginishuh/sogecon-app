import { screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import HomePage from '../app/page';
import { HomeActionsView } from '../components/home/quick-actions';
import { renderWithProviders } from '../tests/render-with-providers';

vi.mock('../services/hero', () => ({
  listHeroSlides: vi.fn(async () => [
    {
      id: 1,
      target_type: 'post',
      target_id: 11,
      title: '미래를 창조하는 서강경제',
      description: '배움과 경험을 이어 새로운 가능성을 만듭니다.',
      image: '/images/home/alumni-networking-hero.webp',
      href: '/posts/11',
      unpublished: false,
    },
  ]),
}));

describe('HomePage hero and cards', () => {
  it('renders hero section with sr-only heading', () => {
    renderWithProviders(<HomePage />);
    // sr-only h1 확인
    expect(screen.getByRole('heading', { name: '서강대 경제대학원 총동문회' })).toBeInTheDocument();
  });

  it('uses a detail-oriented label for the hero slide CTA', async () => {
    renderWithProviders(<HomePage />);
    const link = await screen.findByRole('link', { name: /미래를 창조하는 서강경제 자세히 보기/ });
    expect(link).toHaveAttribute('href', '/posts/11');
    expect(screen.queryByRole('link', { name: /미래를 창조하는 서강경제 동문으로 이어가기/ })).not.toBeInTheDocument();
  });

  it('renders the guest journey without duplicated menu tiles', () => {
    renderWithProviders(<HomeActionsView status="unauthorized" isAdmin={false} />);
    expect(screen.getByRole('link', { name: /동문 가입 신청/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /동문 로그인/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /비밀번호 만들기/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /행사 일정 바로가기/ })).not.toBeInTheDocument();
  });
});
