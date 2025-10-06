"use client";

// 로그인 후 노출되는 푸시 구독 CTA
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from './toast';
import { ensureServiceWorker, getCurrentSubscription, subscribePush, unsubscribePush } from '../lib/push';
import { deleteSubscription, saveSubscription } from '../services/notifications';

export function NotifyCTA() {
  const { status } = useAuth();
  const toast = useToast();
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  // 초기 지원/구독상태 점검
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setSupported(ok);
    if (!ok) return;
    (async () => {
      await ensureServiceWorker();
      const sub = await getCurrentSubscription();
      setSubscribed(!!sub);
    })().catch(() => {});
  }, []);

  if (status !== 'authorized') return null;
  if (!supported) return null;

  const onSubscribe = async () => {
    setBusy(true);
    try {
      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
      if (!vapid) {
        toast.show('VAPID 키가 설정되지 않았습니다(.env 확인).', { type: 'error' });
        return;
      }
      const result = await subscribePush(vapid);
      if (!result) {
        toast.show('알림 권한이 거부되었거나 구독에 실패했습니다.', { type: 'error' });
        return;
      }
      await saveSubscription({ ...result, ua: navigator.userAgent });
      setSubscribed(true);
      toast.show('알림 구독이 활성화되었습니다.', { type: 'success' });
    } catch {
      toast.show('구독 중 오류가 발생했습니다.', { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const onUnsubscribe = async () => {
    setBusy(true);
    try {
      const endpoint = await unsubscribePush();
      if (endpoint) {
        await deleteSubscription(endpoint);
      }
      setSubscribed(false);
      toast.show('알림 구독을 해지했습니다.', { type: 'success' });
    } catch {
      toast.show('해지 중 오류가 발생했습니다.', { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {subscribed ? (
        <button
          disabled={busy}
          onClick={onUnsubscribe}
          className="rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
        >
          알림 끄기
        </button>
      ) : (
        <button
          disabled={busy}
          onClick={onSubscribe}
          className="rounded bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          알림 켜기
        </button>
      )}
    </div>
  );
}
