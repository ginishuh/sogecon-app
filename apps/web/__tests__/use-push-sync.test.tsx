import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  migrateStaleVapidSubscription,
  ensureServiceWorker,
  getCurrentSubscription,
  deleteSubscription,
  saveSubscription,
} = vi.hoisted(() => ({
  migrateStaleVapidSubscription: vi.fn(),
  ensureServiceWorker: vi.fn().mockResolvedValue({}),
  getCurrentSubscription: vi.fn().mockResolvedValue(null),
  deleteSubscription: vi.fn().mockResolvedValue(undefined),
  saveSubscription: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/sw', () => ({
  isServiceWorkerEnabled: () => true,
}));

vi.mock('../lib/push', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/push')>();
  return {
    ...actual,
    migrateStaleVapidSubscription,
    ensureServiceWorker,
    getCurrentSubscription,
  };
});

vi.mock('../services/notifications', () => ({
  deleteSubscription,
  saveSubscription,
}));

import { usePushSync } from '../hooks/usePushSync';

describe('usePushSync stale VAPID migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'configured-vapid-public-key');
    vi.stubGlobal('navigator', {
      serviceWorker: {},
      userAgent: 'vitest',
    });
    vi.stubGlobal('Notification', {});
    vi.stubGlobal('PushManager', {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('marks subscribed=false only after migration completes', async () => {
    migrateStaleVapidSubscription.mockResolvedValue('migrated');

    const { result } = renderHook(() => usePushSync('authorized', 'header'));

    await waitFor(() => {
      expect(migrateStaleVapidSubscription).toHaveBeenCalledWith(
        'configured-vapid-public-key',
        deleteSubscription,
      );
    });
    await waitFor(() => {
      expect(result.current.subscribed).toBe(false);
    });
    expect(getCurrentSubscription).not.toHaveBeenCalled();
  });

  it('does not mark subscribed=false when migration is deferred for retry', async () => {
    migrateStaleVapidSubscription.mockResolvedValue('retry_later');

    const { result } = renderHook(() => usePushSync('authorized', 'drawer'));

    await waitFor(() => {
      expect(migrateStaleVapidSubscription).toHaveBeenCalled();
    });
    expect(result.current.subscribed).toBe(false);
    expect(getCurrentSubscription).not.toHaveBeenCalled();
  });
});
