"use client";

// 로그인 후 노출되는 푸시 구독 CTA
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from './toast';
import { ApiError } from '../lib/api';
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
        toast.show('권한이 거부되었거나 구독에 실패했습니다. 브라우저 알림 권한을 확인하세요.', { type: 'error' });
        return;
      }
      await saveSubscription({ ...result, ua: navigator.userAgent });
      setSubscribed(true);
      toast.show('알림 구독이 활성화되었습니다.', { type: 'success' });
    } catch (e) {
      const msg = e instanceof ApiError && e.status === 401
        ? '로그인 후 다시 시도하세요.'
        : '구독 중 오류가 발생했습니다.';
      toast.show(msg, { type: 'error' });
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
    } catch (e) {
      const msg = e instanceof ApiError && e.status === 401
        ? '로그인 후 다시 시도하세요.'
        : '해지 중 오류가 발생했습니다.';
      toast.show(msg, { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2 border-t border-neutral-border pt-4 mt-auto">
      <svg className="size-5 text-neutral-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M10 2a6 6 0 0 0-6 6v3l-1 2h14l-1-2V8a6 6 0 0 0-6-6zM8 15a2 2 0 1 0 4 0" />
      </svg>
      {subscribed ? (
        <button
          disabled={busy}
          onClick={onUnsubscribe}
          className="flex-1 rounded-[10px] border border-neutral-border px-3 py-2.5 text-sm text-neutral-ink hover:bg-neutral-surface disabled:opacity-50 transition-colors"
        >
          알림 끄기
        </button>
      ) : (
        <button
          disabled={busy}
          onClick={onSubscribe}
          className="flex-1 rounded-[10px] bg-brand-primary px-3 py-2.5 text-sm text-white hover:bg-[#6c1722] disabled:opacity-50 transition-colors"
        >
          알림 켜기
        </button>
      )}
    </div>
  );
}
