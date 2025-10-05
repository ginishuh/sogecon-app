'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const register = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js');
        // noop skeleton; add push/offline logic later
      } catch (error) {
        console.info('Service worker registration skipped', error);
      }
    };

    void register();
  }, []);

  return null;
}
