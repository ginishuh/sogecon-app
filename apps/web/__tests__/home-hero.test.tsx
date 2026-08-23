import { screen } from '@testing-library/react';
import * as axe from 'axe-core';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import HomePage from '../app/page';
import HomeHeroCarousel from '../components/home/hero-carousel';
import { HomeActionsView } from '../components/home/quick-actions';
import { API_BASE } from '../lib/api';
import { listHeroSlides } from '../services/hero';
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

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    status: 'unauthorized',
    data: null,
  }),
}));

const axeOptions: axe.RunOptions = {
  rules: {
    'document-title': { enabled: false },
    'color-contrast': { enabled: false },
  },
};

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

  it('keeps inactive slide links out of the tab order and shares one prev/next control', async () => {
    vi.mocked(listHeroSlides).mockResolvedValueOnce([
      {
        id: 1,
        target_type: 'post',
        target_id: 11,
        title: '첫 배너',
        description: '활성 슬라이드',
        image: '/images/home/alumni-networking-hero.webp',
        href: '/posts/11',
        unpublished: false,
      },
      {
        id: 2,
        target_type: 'post',
        target_id: 12,
        title: '둘째 배너',
        description: '숨김 슬라이드',
        image: '/images/home/alumni-networking-hero.webp',
        href: '/posts/12',
        unpublished: false,
      },
    ]);

    const { container } = renderWithProviders(<HomeHeroCarousel />);
    expect(await screen.findByRole('link', { name: '첫 배너 자세히 보기' })).toHaveAttribute('href', '/posts/11');
    expect(screen.queryByRole('link', { name: '둘째 배너 자세히 보기' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '이전 배너' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: '다음 배너' })).toHaveLength(1);

    const carousel = container.querySelector('[aria-roledescription="carousel"]');
    expect(carousel).not.toBeNull();
    const result = await axe.run(carousel as HTMLElement, axeOptions);
    expect(result.violations.map(({ id, impact }) => ({ id, impact }))).toEqual([]);
  });

  it('resolves uploaded hero images through the API origin', async () => {
    vi.mocked(listHeroSlides).mockResolvedValueOnce([
      {
        id: 3,
        target_type: 'post',
        target_id: 13,
        title: '업로드 배너',
        description: 'API 미디어 경로',
        image: '/media/images/hero.jpg',
        href: '/posts/13',
        unpublished: false,
      },
    ]);

    const { container } = renderWithProviders(<HomeHeroCarousel />);
    expect(await screen.findByRole('link', { name: '업로드 배너 자세히 보기' })).toBeInTheDocument();
    const image = container.querySelector('img');
    expect(image).toHaveAttribute('src', `${API_BASE}/media/images/hero.jpg`);
  });
});
