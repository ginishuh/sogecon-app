'use client';

import { useEffect } from 'react';
import { useSwUpdate, setWaitingWorker } from './contexts/sw-update-context';

export function ServiceWorkerRegister() {
  const { setUpdateAvailable } = useSwUpdate();

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

    // 리스너 참조 저장 (클린업용)
    let registration: ServiceWorkerRegistration | null = null;
    let refreshing = false;

    const handleControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register('/sw.js');

        // 이미 대기 중인 SW가 있으면 업데이트 가능 상태로 설정
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setUpdateAvailable(true);
        }

        // 새 SW 설치 감지
        const handleUpdateFound = () => {
          const newWorker = registration?.installing;
          if (!newWorker) return;

          const handleStateChange = () => {
            // 새 SW가 installed 상태이고, 이미 활성화된 controller가 있으면 업데이트
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(newWorker);
              setUpdateAvailable(true);
            }
          };

          // once: true로 중복 등록 방지
          newWorker.addEventListener('statechange', handleStateChange, { once: true });
        };

        // once: true로 StrictMode 재실행 시 중복 등록 방지
        registration.addEventListener('updatefound', handleUpdateFound, { once: true });

        // controller가 변경되면 페이지 리로드 (새 SW가 활성화됨)
        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
      } catch (error) {
        console.info('Service worker registration skipped', error);
      }
    };

    void register();

    // 클린업: controllerchange 리스너 제거
    // updatefound/statechange는 once: true로 등록되어 자동 제거됨
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, [setUpdateAvailable]);

  return null;
}
