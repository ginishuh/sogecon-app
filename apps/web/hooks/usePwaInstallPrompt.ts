"use client";

import { useCallback, useEffect, useState } from 'react';

type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

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
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /safari/.test(ua) && !/crios|fxios|edgios|optios/.test(ua);
  return isIOSDevice && isSafari;
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

    const media = window.matchMedia('(display-mode: standalone)');
    const onDisplayModeChange = () => syncInstalled();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onDisplayModeChange);
    } else {
      media.addListener(onDisplayModeChange);
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      if (typeof media.removeEventListener === 'function') {
        media.removeEventListener('change', onDisplayModeChange);
      } else {
        media.removeListener(onDisplayModeChange);
      }
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener);
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
