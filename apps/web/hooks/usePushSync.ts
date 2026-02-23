"use client";

import { useEffect, useState } from 'react';
import type { AuthStatus } from './useAuth';
import { ensureServiceWorker, getCurrentSubscription, subscriptionToResult } from '../lib/push';
import { isServiceWorkerEnabled } from '../lib/sw';
import { saveSubscription } from '../services/notifications';

type SourceTag = 'header' | 'drawer';

export function usePushSync(authStatus: AuthStatus, source: SourceTag) {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ok =
      isServiceWorkerEnabled() &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
    setSupported(ok);
    if (!ok || authStatus !== 'authorized') return;

    let cancelled = false;
    (async () => {
      await ensureServiceWorker();
      const sub = await getCurrentSubscription();
      if (cancelled) return;
      setSubscribed(!!sub);
      if (!sub) return;

      const result = subscriptionToResult(sub);
      if (!result) return;

      // 서버 DB에서 구독이 유실된 경우를 대비해 로그인 시점에 자동 동기화
      await saveSubscription({ ...result, ua: navigator.userAgent }).catch((e) => {
        console.warn(`[push-resync] failed to sync subscription (${source})`, e);
      });
    })().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [authStatus, source]);

  return { supported, subscribed, setSubscribed };
}
