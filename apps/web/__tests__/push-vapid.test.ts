import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/sw', () => ({
  isServiceWorkerEnabled: () => true,
}));

import {
  migrateStaleVapidSubscription,
  subscriptionMatchesVapidKey,
} from '../lib/push';

function bytesToVapidPublicKey(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function makeSubscription(bytes: Uint8Array, endpoint = 'https://example.com/push/1'): PushSubscription {
  return {
    endpoint,
    options: { applicationServerKey: bytes },
    unsubscribe: vi.fn().mockResolvedValue(true),
  } as unknown as PushSubscription;
}

function stubNavigatorWithSubscription(sub: PushSubscription | null) {
  const reg = {
    pushManager: {
      getSubscription: vi.fn().mockResolvedValue(sub),
    },
  };
  vi.stubGlobal('navigator', {
    serviceWorker: {
      getRegistration: vi.fn().mockResolvedValue(reg),
    },
  });
  return reg;
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

describe('migrateStaleVapidSubscription', () => {
  const currentKey = bytesToVapidPublicKey(Uint8Array.from([9, 9, 9]));

  it('returns not_stale when browser subscription matches current VAPID key', async () => {
    const matching = makeSubscription(Uint8Array.from([9, 9, 9]));
    stubNavigatorWithSubscription(matching);
    const deleteServer = vi.fn().mockResolvedValue(undefined);

    await expect(migrateStaleVapidSubscription(currentKey, deleteServer)).resolves.toBe('not_stale');
    expect(deleteServer).not.toHaveBeenCalled();
    expect(matching.unsubscribe).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('deletes server subscription before browser unsubscribe on stale migration', async () => {
    const stale = makeSubscription(Uint8Array.from([1, 2, 3]));
    stubNavigatorWithSubscription(stale);
    const calls: string[] = [];
    const deleteServer = vi.fn().mockImplementation(async () => {
      calls.push('server-delete');
    });
    stale.unsubscribe = vi.fn().mockImplementation(async () => {
      calls.push('browser-unsubscribe');
      return true;
    });

    await expect(migrateStaleVapidSubscription(currentKey, deleteServer)).resolves.toBe('migrated');
    expect(deleteServer).toHaveBeenCalledWith('https://example.com/push/1');
    expect(stale.unsubscribe).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['server-delete', 'browser-unsubscribe']);
    vi.unstubAllGlobals();
  });

  it('returns retry_later when server delete fails and preserves browser subscription', async () => {
    const stale = makeSubscription(Uint8Array.from([1, 2, 3]));
    stubNavigatorWithSubscription(stale);
    const deleteServer = vi.fn().mockRejectedValue(new Error('network'));

    await expect(migrateStaleVapidSubscription(currentKey, deleteServer)).resolves.toBe('retry_later');
    expect(deleteServer).toHaveBeenCalledWith('https://example.com/push/1');
    expect(stale.unsubscribe).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('returns retry_later when browser unsubscribe fails after successful server delete', async () => {
    const stale = makeSubscription(Uint8Array.from([1, 2, 3]));
    stubNavigatorWithSubscription(stale);
    const deleteServer = vi.fn().mockResolvedValue(undefined);
    stale.unsubscribe = vi.fn().mockResolvedValue(false);

    await expect(migrateStaleVapidSubscription(currentKey, deleteServer)).resolves.toBe('retry_later');
    expect(deleteServer).toHaveBeenCalledTimes(1);
    expect(stale.unsubscribe).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
