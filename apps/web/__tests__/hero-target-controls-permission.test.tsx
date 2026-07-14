import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useHeroTargetControls } from '../hooks/useHeroTargetControls';
import { lookupAdminHeroItems } from '../services/hero';

vi.mock('../services/hero', () => ({
  lookupAdminHeroItems: vi.fn(),
  createAdminHeroItem: vi.fn(),
  updateAdminHeroItem: vi.fn(),
}));

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useHeroTargetControls permission boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(lookupAdminHeroItems).mockResolvedValue({ items: [] });
  });

  it('admin_hero 권한이 없으면 lookup 요청을 보내지 않는다', async () => {
    renderHook(
      () =>
        useHeroTargetControls({
          targetType: 'post',
          targetIds: [1, 2],
          showToast: vi.fn(),
          enabled: false,
        }),
      { wrapper: createWrapper() },
    );

    await Promise.resolve();
    expect(lookupAdminHeroItems).not.toHaveBeenCalled();
  });

  it('admin_hero 권한이 있으면 대상 lookup을 한 번 수행한다', async () => {
    renderHook(
      () =>
        useHeroTargetControls({
          targetType: 'event',
          targetIds: [3],
          showToast: vi.fn(),
          enabled: true,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(lookupAdminHeroItems).toHaveBeenCalledWith({
        target_type: 'event',
        target_ids: [3],
      });
    });
    expect(lookupAdminHeroItems).toHaveBeenCalledTimes(1);
  });
});
