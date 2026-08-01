import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import HomeHeroCarousel from '../components/home/hero-carousel';
import { renderWithProviders } from '../tests/render-with-providers';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    status: 'authorized',
    data: {
      kind: 'admin',
      student_id: 'admin001',
      email: 'admin@example.com',
      name: 'Hero 관리자',
      roles: ['member', 'admin', 'admin_hero'],
    },
  }),
}));

vi.mock('../services/hero', () => ({
  listHeroSlides: vi.fn(async () => [
    {
      id: 1,
      target_type: 'post',
      target_id: 42,
      title: '예약 공지',
      description: '관리자 미리보기 대상',
      image: '/images/home/hero.svg',
      href: '/posts/42',
      unpublished: true,
    },
  ]),
}));

describe('admin hero preview entrypoint', () => {
  it('미발행 게시글 슬라이드는 admin preview 경로로 연결한다', async () => {
    renderWithProviders(<HomeHeroCarousel />);

    const link = await screen.findByRole('link', { name: '예약 공지 자세히 보기' });
    expect(link).toHaveAttribute('href', '/admin/posts/42/preview');
    expect(screen.getByText('관리자 미리보기')).toBeInTheDocument();
  });
});
