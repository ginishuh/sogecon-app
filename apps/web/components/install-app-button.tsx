"use client";

import { useState } from 'react';
import { useToast } from './toast';
import { usePwaInstallPrompt } from '../hooks/usePwaInstallPrompt';

type InstallAppButtonProps = {
  variant?: 'desktop' | 'drawer';
};

export function InstallAppButton({ variant = 'desktop' }: InstallAppButtonProps) {
  const toast = useToast();
  const { canPromptInstall, isInstalled, isIOSSafari, promptInstall } = usePwaInstallPrompt();
  const [busy, setBusy] = useState(false);

  if (isInstalled) return null;

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (canPromptInstall) {
        const outcome = await promptInstall();
        if (outcome === 'accepted') {
          toast.show('설치 요청을 보냈습니다. 설치가 완료되면 앱 아이콘이 추가됩니다.', {
            type: 'success',
            durationMs: 3500,
          });
          return;
        }
        if (outcome === 'dismissed') {
          toast.show('설치가 취소되었습니다.', { type: 'info' });
          return;
        }
      }

      if (isIOSSafari) {
        toast.show('Safari 공유 버튼에서 "홈 화면에 추가"를 선택해 주세요.', {
          type: 'info',
          durationMs: 4500,
        });
        return;
      }

      toast.show('브라우저 메뉴에서 "앱 설치" 또는 "홈 화면에 추가"를 선택해 주세요.', {
        type: 'info',
        durationMs: 4500,
      });
    } finally {
      setBusy(false);
    }
  };

  if (variant === 'drawer') {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={onClick}
        className="w-full rounded-[10px] border border-brand-primary px-3 py-2.5 text-sm text-brand-primary transition-colors hover:bg-brand-primary/5 disabled:opacity-50"
      >
        앱 설치하기
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="px-3 py-2 text-sm text-brand-primary border border-brand-primary rounded-lg hover:bg-brand-primary/5 transition-colors disabled:opacity-50"
    >
      앱 설치
    </button>
  );
}
