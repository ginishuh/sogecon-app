// 브라우저 Web Push 유틸리티(서비스워커/구독 관리)

import { isServiceWorkerEnabled } from './sw';

export type SubscribeResult = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

function canUsePush(): boolean {
  if (typeof window === 'undefined') return false;
  if (!isServiceWorkerEnabled()) return false;
  return ['serviceWorker' in navigator, 'PushManager' in window, 'Notification' in window].every(Boolean);
}

export function subscriptionToResult(sub: PushSubscription): SubscribeResult | null {
  const json = sub.toJSON();
  const endpoint = json.endpoint;
  if (!endpoint) return null;

  const keys = json.keys;
  if (!keys) return null;

  const p256dh = keys.p256dh;
  const auth = keys.auth;
  if (!p256dh || !auth) return null;

  return { endpoint, p256dh, auth };
}

// urlBase64 → Uint8Array (VAPID public key 변환)
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = typeof window !== 'undefined' ? window.atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  if (!isServiceWorkerEnabled()) return null;

  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;

  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (error) {
    console.info('Service worker registration failed', error);
    return null;
  }
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  if (!isServiceWorkerEnabled()) return null;

  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  return await reg.pushManager.getSubscription();
}

export async function subscribePush(vapidPublicKey: string): Promise<SubscribeResult | null> {
  if (!canUsePush()) return null;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;
  const reg = await ensureServiceWorker();
  if (!reg) return null;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
  });
  return subscriptionToResult(sub);
}

export async function unsubscribePush(): Promise<string | null> {
  const current = await getCurrentSubscription();
  if (!current) return null;
  const endpoint = current.endpoint;
  const ok = await current.unsubscribe().catch(() => false);
  return ok ? endpoint : null;
}
