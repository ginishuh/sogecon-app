"use client";

import { useCallback, useEffect, useState } from 'react';

type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  const isIOSDevice =
    /iphone|ipad|ipod/.test(ua) ||
    (navigator.maxTouchPoints > 1 && /macintosh/.test(ua));
  const isSafari = /safari/.test(ua) && !/crios|fxios|edgios|optios/.test(ua);
  return isIOSDevice && isSafari;
}

// useEffect 등록 전에 발생하는 beforeinstallprompt 이벤트를 모듈 스코프에서 캡처.
// 모바일 브라우저에서 페이지 로드 직후 이벤트가 발생하면 React 마운트가 아직
// 완료되지 않아 리스너를 놓치는 타이밍 이슈를 방지합니다.
let _earlyPromptEvent: BeforeInstallPromptEvent | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _earlyPromptEvent = e as BeforeInstallPromptEvent;
  }, { once: true });
}

export function usePwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [iosSafari, setIosSafari] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIosSafari(isIOSSafari());
    const syncInstalled = () => setIsInstalled(isStandaloneMode());
    syncInstalled();

    // useEffect 등록 전에 캡처된 이벤트가 있으면 즉시 반영
    if (_earlyPromptEvent) {
      setDeferredPrompt(_earlyPromptEvent);
      _earlyPromptEvent = null;
    }

    const media = window.matchMedia('(display-mode: standalone)');
    const onDisplayModeChange = () => syncInstalled();
    media.addEventListener('change', onDisplayModeChange);

    const onBeforeInstallPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      _earlyPromptEvent = null;
      setDeferredPrompt(event);
    };
    const onAppInstalled = () => {
      setDeferredPrompt(null);
      _earlyPromptEvent = null;
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      media.removeEventListener('change', onDisplayModeChange);
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<InstallOutcome> => {
    if (!deferredPrompt) return 'unavailable';
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (choice.outcome === 'accepted') {
      setIsInstalled(true);
    }
    return choice.outcome;
  }, [deferredPrompt]);

  return {
    canPromptInstall: deferredPrompt !== null,
    isInstalled,
    isIOSSafari: iosSafari,
    promptInstall,
  };
}
