'use client';

import Link from 'next/link';

export function OfflineActionButtons() {
  return (
    <div
      className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4"
      role="group"
      aria-label="오프라인 복구 조치"
    >
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="w-full rounded-md bg-brand-primary px-4 py-2 text-base font-medium text-white shadow-sm focus:outline-none focus-visible:ring focus-visible:ring-brand-primary/60 sm:w-auto"
      >
        다시 시도
      </button>
      <Link
        href="/"
        className="w-full rounded-md border border-brand-primary px-4 py-2 text-center text-base font-medium text-brand-primary focus:outline-none focus-visible:ring focus-visible:ring-brand-primary/60 sm:w-auto"
      >
        홈으로 이동
      </Link>
    </div>
  );
}
