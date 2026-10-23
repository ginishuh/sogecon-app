import { screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HomeDesktopCards from '../components/home/desktop-cards';
import { API_BASE } from '../lib/api';
import { listEvents } from '../services/events';
import { listHeroSlides, type HeroSlide } from '../services/hero';
import { renderWithProviders } from '../tests/render-with-providers';

vi.mock('../services/events', () => ({ listEvents: vi.fn() }));
vi.mock('../services/posts', () => ({ listPosts: vi.fn(async () => []) }));
vi.mock('../services/hero', () => ({ listHeroSlides: vi.fn() }));

const fallback = '/images/home/alumni-networking-hero.webp';
const banner = (overrides: Partial<HeroSlide> = {}): HeroSlide => ({
  id: 5, target_type: 'event', target_id: 2, title: 'Banner',
  description: '', image: '/media/images/event.png', href: '/events/2',
  unpublished: false, ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listEvents).mockResolvedValue([
    { id: 3, title: 'Later', description: '', starts_at: '2099-02-01T00:00:00Z', ends_at: '2099-02-02T00:00:00Z', location: 'Seoul', capacity: 10 },
    { id: 2, title: 'Upcoming', description: '', starts_at: '2099-01-01T00:00:00Z', ends_at: '2099-01-02T00:00:00Z', location: 'Seoul', capacity: 10 },
  ]);
  vi.mocked(listHeroSlides).mockResolvedValue([]);
});

describe('upcoming event image', () => {
  it.each([
    ['matching event', [banner()], `${API_BASE}/media/images/event.png`],
    ['another event only', [banner({ target_id: 3 })], fallback],
    ['post with same ID', [banner({ target_type: 'post' })], fallback],
    ['missing image', [banner({ image: null })], fallback],
    ['blank image', [banner({ image: '  ' })], fallback],
    ['no banner', [], fallback],
    ['unpublished banner', [banner({ unpublished: true })], fallback],
    ['server priority', [banner(), banner({ id: 6, image: '/media/images/second.png' })], `${API_BASE}/media/images/event.png`],
  ] as const)('renders %s without changing the selected event', async (_name, slides, expected) => {
    vi.mocked(listHeroSlides).mockResolvedValue([...slides]);
    renderWithProviders(<HomeDesktopCards />);
    const link = await screen.findByRole('link', { name: /Upcoming/ });
    await waitFor(() => expect(listHeroSlides).toHaveBeenCalledWith({ event_id: 2, limit: 1 }));
    await waitFor(() => expect(link.querySelector('img')).toHaveAttribute('src', expected));
    expect(link).toHaveAttribute('href', '/events/2');
  });

  it('does not request an image when no upcoming event exists', async () => {
    vi.mocked(listEvents).mockResolvedValue([]);
    renderWithProviders(<HomeDesktopCards />);
    await screen.findByText(/새 행사를 준비하고 있어요/);
    expect(listHeroSlides).not.toHaveBeenCalled();
  });
});
