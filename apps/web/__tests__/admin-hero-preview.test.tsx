import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HomeHeroCarousel from '../components/home/hero-carousel';
import { renderWithProviders } from '../tests/render-with-providers';

const mocks = vi.hoisted(() => ({
  roles: ['member', 'admin', 'admin_hero'],
  listHeroSlides: vi.fn(),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    status: 'authorized',
    data: {
      kind: 'admin',
      student_id: 'admin001',
      email: 'admin@example.com',
      name: 'Hero 관리자',
      roles: mocks.roles,
    },
  }),
}));

vi.mock('../services/hero', () => ({
  listHeroSlides: (...args: unknown[]) => mocks.listHeroSlides(...args),
}));

const unpublishedSlide = {
  id: 1,
  target_type: 'post' as const,
  target_id: 42,
  title: '예약 공지',
  description: '관리자 미리보기 대상',
  image: '/images/home/hero.svg',
  href: '/posts/42',
  unpublished: true,
};

describe('admin hero preview entrypoint', () => {
  beforeEach(() => {
    mocks.roles = ['member', 'admin', 'admin_hero'];
    mocks.listHeroSlides.mockReset();
    mocks.listHeroSlides.mockResolvedValue([unpublishedSlide]);
  });

  it('미발행 게시글 슬라이드는 admin preview 경로로 연결한다', async () => {
    renderWithProviders(<HomeHeroCarousel />);

    const link = await screen.findByRole('link', { name: '예약 공지 자세히 보기' });
    expect(link).toHaveAttribute('href', '/admin/posts/42/preview');
    expect(screen.getByText('관리자 미리보기')).toBeInTheDocument();
    expect(mocks.listHeroSlides).toHaveBeenCalledWith({
      limit: 8,
      include_unpublished: true,
    });
  });

  it('일반 admin 등급만 있으면 미발행 hero를 관리자 preview로 승격하지 않는다', async () => {
    mocks.roles = ['member', 'admin'];

    renderWithProviders(<HomeHeroCarousel />);

    const link = await screen.findByRole('link', { name: '예약 공지 자세히 보기' });
    expect(link).toHaveAttribute('href', '/posts/42');
    expect(screen.queryByText('관리자 미리보기')).not.toBeInTheDocument();
    expect(mocks.listHeroSlides).toHaveBeenCalledWith({
      limit: 8,
      include_unpublished: false,
    });
  });
});
