'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // 개발환경(RSC 스트리밍 중)에서는 기존에 등록된 SW가 스트림을 끊는 케이스가 있어 기본 비활성화합니다.
    // NEXT_PUBLIC_ENABLE_SW=1 로 강제 등록 가능. 비활성화 시 기존 SW가 있다면 해제(unregister).
    const enable = process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ENABLE_SW === '1';
    if (!enable) {
      // best-effort unregister without forcing a reload
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
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
