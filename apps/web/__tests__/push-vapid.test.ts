import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/sw', () => ({
  isServiceWorkerEnabled: () => true,
}));

import {
  clearStaleVapidSubscription,
  subscriptionMatchesVapidKey,
} from '../lib/push';

function bytesToVapidPublicKey(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function makeSubscription(bytes: Uint8Array): PushSubscription {
  return {
    endpoint: 'https://example.com/push/1',
    options: { applicationServerKey: bytes },
    unsubscribe: vi.fn().mockResolvedValue(true),
  } as unknown as PushSubscription;
}

describe('subscriptionMatchesVapidKey', () => {
  it('returns true when applicationServerKey matches configured VAPID public key', () => {
    const bytes = Uint8Array.from([9, 8, 7, 6, 5, 4, 3, 2, 1]);
    const sub = makeSubscription(bytes);
    expect(subscriptionMatchesVapidKey(sub, bytesToVapidPublicKey(bytes))).toBe(true);
  });

  it('returns false when applicationServerKey was created with a different VAPID key', () => {
    const current = Uint8Array.from([1, 2, 3, 4, 5]);
    const stale = Uint8Array.from([5, 4, 3, 2, 1]);
    const sub = makeSubscription(stale);
    expect(subscriptionMatchesVapidKey(sub, bytesToVapidPublicKey(current))).toBe(false);
  });
});

describe('clearStaleVapidSubscription', () => {
  it('unsubscribes stale browser subscription without re-requesting permission', async () => {
    const staleBytes = Uint8Array.from([1, 2, 3]);
    const currentKey = bytesToVapidPublicKey(Uint8Array.from([9, 9, 9]));
    const stale = makeSubscription(staleBytes);
    const reg = {
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue(stale),
      },
    };
    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistration: vi.fn().mockResolvedValue(reg),
      },
    });

    const cleared = await clearStaleVapidSubscription(currentKey);
    expect(cleared).toBe(true);
    expect(stale.unsubscribe).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
