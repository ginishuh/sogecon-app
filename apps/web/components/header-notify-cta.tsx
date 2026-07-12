"use client";

import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { usePushSync } from '../hooks/usePushSync';
import { useToast } from './toast';
import { ApiError } from '../lib/api';
import { subscribePushWithReason, unsubscribePush } from '../lib/push';
import { deleteSubscription, saveSubscription } from '../services/notifications';
import { MEMBER_LANGUAGE } from '../lib/member-language';

export function HeaderNotifyCTA() {
  const { status } = useAuth();
  const toast = useToast();
  const { supported, subscribed, setSubscribed } = usePushSync(status, 'header');
  const [busy, setBusy] = useState(false);

  if (status !== 'authorized') return null;
  if (!supported) return null;

  const onToggle = async () => {
    setBusy(true);
    try {
      if (subscribed) {
        const endpoint = await unsubscribePush();
        if (endpoint) {
          await deleteSubscription(endpoint);
        }
        setSubscribed(false);
        toast.show(MEMBER_LANGUAGE.notificationOffSuccess, { type: 'success' });
      } else {
        const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
        if (!vapid) {
          toast.show(MEMBER_LANGUAGE.notificationUnavailable, { type: 'error' });
          return;
        }
        const attempt = await subscribePushWithReason(vapid);
        if (!attempt.ok) {
          const reasonMessage: Record<string, string> = {
            unsupported: MEMBER_LANGUAGE.notificationUnsupported,
            permission_denied: '브라우저 설정에서 이 사이트의 알림 권한을 허용해 주세요.',
            permission_dismissed: '알림 권한 요청이 취소되었습니다.',
            service_worker_unavailable: '알림을 준비하지 못했습니다. 새로고침 후 다시 시도해 주세요.',
            subscribe_failed: '알림을 켜지 못했습니다. 잠시 후 다시 시도해 주세요.',
          };
          toast.show(reasonMessage[attempt.reason] ?? MEMBER_LANGUAGE.notificationUnavailable, { type: 'error' });
          return;
        }
        await saveSubscription({ ...attempt.result, ua: navigator.userAgent });
        setSubscribed(true);
        toast.show(MEMBER_LANGUAGE.notificationOnSuccess, { type: 'success' });
      }
    } catch (e) {
      const msg = e instanceof ApiError && e.status === 401
        ? '로그인 후 다시 시도하세요.'
        : MEMBER_LANGUAGE.notificationUnavailable;
      toast.show(msg, { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      disabled={busy}
      aria-busy={busy}
      onClick={onToggle}
      className={`relative p-2 rounded-lg transition-colors disabled:opacity-50 ${
        subscribed
          ? 'text-brand-700 hover:bg-brand-50'
          : 'text-neutral-muted hover:bg-neutral-subtle'
      }`}
      aria-label={busy ? '새 소식 알림 처리 중' : subscribed ? MEMBER_LANGUAGE.notificationOff : MEMBER_LANGUAGE.notificationOn}
      title={subscribed ? MEMBER_LANGUAGE.notificationOff : MEMBER_LANGUAGE.notificationOn}
    >
      <svg className="size-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M10 2a6 6 0 0 0-6 6v3l-1 2h14l-1-2V8a6 6 0 0 0-6-6zM8 15a2 2 0 1 0 4 0" />
      </svg>
      {subscribed && (
        <span className="absolute top-1 right-1 size-2 bg-brand-700 rounded-full" />
      )}
    </button>
  );
}
