'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // 개발환경(RSC 스트리밍 중)에선 서비스워커 등록이 연결 종료 에러를 유발할 수 있어 기본 비활성화합니다.
    // NEXT_PUBLIC_ENABLE_SW=1로 강제 등록 가능.
    const enable = process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ENABLE_SW === '1';
    if (!enable) return;

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
