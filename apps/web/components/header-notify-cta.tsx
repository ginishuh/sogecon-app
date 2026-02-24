"use client";

import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { usePushSync } from '../hooks/usePushSync';
import { useToast } from './toast';
import { ApiError } from '../lib/api';
import { subscribePushWithReason, unsubscribePush } from '../lib/push';
import { deleteSubscription, saveSubscription } from '../services/notifications';

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
        toast.show('알림을 해제했습니다.', { type: 'success' });
      } else {
        const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
        if (!vapid) {
          toast.show('VAPID 키가 설정되지 않았습니다.', { type: 'error' });
          return;
        }
        const attempt = await subscribePushWithReason(vapid);
        if (!attempt.ok) {
          const reasonMessage: Record<string, string> = {
            unsupported: '이 브라우저는 웹 푸시를 지원하지 않습니다.',
            permission_denied: '브라우저 설정에서 이 사이트의 알림 권한을 허용해 주세요.',
            permission_dismissed: '알림 권한 요청이 취소되었습니다.',
            service_worker_unavailable: '서비스 워커 등록에 실패했습니다. 새로고침 후 다시 시도해 주세요.',
            subscribe_failed: '구독 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.',
          };
          toast.show(reasonMessage[attempt.reason] ?? '알림 활성화에 실패했습니다.', { type: 'error' });
          return;
        }
        await saveSubscription({ ...attempt.result, ua: navigator.userAgent });
        setSubscribed(true);
        toast.show('알림을 활성화했습니다.', { type: 'success' });
      }
    } catch (e) {
      const msg = e instanceof ApiError && e.status === 401
        ? '로그인 후 다시 시도하세요.'
        : '오류가 발생했습니다.';
      toast.show(msg, { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      disabled={busy}
      onClick={onToggle}
      className={`relative p-2 rounded-lg transition-colors disabled:opacity-50 ${
        subscribed
          ? 'text-brand-700 hover:bg-brand-50'
          : 'text-neutral-muted hover:bg-neutral-subtle'
      }`}
      aria-label={subscribed ? '알림 끄기' : '알림 켜기'}
      title={subscribed ? '알림 끄기' : '알림 켜기'}
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
