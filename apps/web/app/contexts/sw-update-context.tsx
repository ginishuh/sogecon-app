'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface SwUpdateContextValue {
  /** 새 서비스워커가 대기 중인지 여부 */
  updateAvailable: boolean;
  /** 업데이트 상태 설정 (sw-register에서 호출) */
  setUpdateAvailable: (available: boolean) => void;
  /** 대기 중인 SW에 skipWaiting 메시지를 보내고 페이지 리로드 */
  applyUpdate: () => void;
  /** 배너 닫기 (세션 내 숨김) */
  dismissBanner: () => void;
  /** 배너가 닫혔는지 여부 */
  bannerDismissed: boolean;
}

const SwUpdateContext = createContext<SwUpdateContextValue | null>(null);

// 대기 중인 SW 참조 저장
let waitingWorker: ServiceWorker | null = null;

export function setWaitingWorker(sw: ServiceWorker | null) {
  waitingWorker = sw;
}

export function SwUpdateProvider({ children }: { children: ReactNode }) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const applyUpdate = useCallback(() => {
    if (waitingWorker) {
      // SW에 SKIP_WAITING 메시지 전송
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
    // controllerchange 이벤트에서 리로드하므로 여기서는 대기
  }, []);

  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
  }, []);

  return (
    <SwUpdateContext.Provider
      value={{
        updateAvailable,
        setUpdateAvailable,
        applyUpdate,
        dismissBanner,
        bannerDismissed
      }}
    >
      {children}
    </SwUpdateContext.Provider>
  );
}

export function useSwUpdate() {
  const context = useContext(SwUpdateContext);
  if (!context) {
    throw new Error('useSwUpdate must be used within SwUpdateProvider');
  }
  return context;
}
