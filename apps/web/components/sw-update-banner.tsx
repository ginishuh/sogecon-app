'use client';

import { useSwUpdate } from '../app/contexts/sw-update-context';

/**
 * PWA 업데이트 알림 배너
 * 새 서비스워커가 대기 중일 때 화면 하단에 표시됩니다.
 */
export function SwUpdateBanner() {
  const { updateAvailable, applyUpdate, dismissBanner, bannerDismissed } = useSwUpdate();

  // 업데이트가 없거나 배너가 닫힌 경우 렌더링하지 않음
  if (!updateAvailable || bannerDismissed) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-3 bg-slate-800 px-4 py-3 text-white shadow-lg sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-sm sm:rounded-lg"
    >
      <p className="text-sm">새 버전이 있습니다.</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={applyUpdate}
          className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-800"
        >
          새로고침
        </button>
        <button
          type="button"
          onClick={dismissBanner}
          aria-label="닫기"
          className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-500"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
