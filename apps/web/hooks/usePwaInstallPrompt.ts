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

type PromptListener = (event: BeforeInstallPromptEvent | null) => void;

let _sharedPromptEvent: BeforeInstallPromptEvent | null = null;
const _promptListeners = new Set<PromptListener>();
let _globalPromptHandlersBound = false;

function _setSharedPromptEvent(event: BeforeInstallPromptEvent | null) {
  _sharedPromptEvent = event;
  _promptListeners.forEach((listener) => listener(event));
}

function _subscribePrompt(listener: PromptListener): () => void {
  _promptListeners.add(listener);
  return () => {
    _promptListeners.delete(listener);
  };
}

function _bindGlobalPromptHandlers() {
  if (typeof window === 'undefined' || _globalPromptHandlersBound) return;
  _globalPromptHandlersBound = true;

  // 전역 1회 바인딩: 여러 Install 버튼 인스턴스가 있어도 동일 prompt 상태를 공유.
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    _setSharedPromptEvent(event as BeforeInstallPromptEvent);
  });
  window.addEventListener('appinstalled', () => {
    _setSharedPromptEvent(null);
  });
}

_bindGlobalPromptHandlers();

export function usePwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(_sharedPromptEvent);
  const [isInstalled, setIsInstalled] = useState(false);
  const [iosSafari, setIosSafari] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIosSafari(isIOSSafari());
    const syncInstalled = () => setIsInstalled(isStandaloneMode());
    syncInstalled();
    setDeferredPrompt(_sharedPromptEvent);

    const media = window.matchMedia('(display-mode: standalone)');
    const onDisplayModeChange = () => syncInstalled();
    media.addEventListener('change', onDisplayModeChange);
    const onAppInstalled = () => setIsInstalled(true);
    window.addEventListener('appinstalled', onAppInstalled);
    const unsubscribe = _subscribePrompt((event) => setDeferredPrompt(event));

    return () => {
      media.removeEventListener('change', onDisplayModeChange);
      window.removeEventListener('appinstalled', onAppInstalled);
      unsubscribe();
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<InstallOutcome> => {
    if (!deferredPrompt) return 'unavailable';
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    _setSharedPromptEvent(null);
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
