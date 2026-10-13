'use client';

import './globals.css';
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

// 루트 레이아웃까지 실패한 경우에만 렌더링된다.
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ko">
      <body className="bg-surface text-text-primary antialiased">
        <main
          className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6 py-16 text-center"
          aria-labelledby="global-error-heading"
        >
          <h1 id="global-error-heading" className="text-3xl font-semibold text-brand-primary">
            화면을 불러오지 못했어요
          </h1>
          <p className="text-base leading-relaxed">
            일시적인 문제로 페이지를 표시할 수 없습니다. 다시 시도해도 계속되면 잠시 후 홈에서 다시 접속해 주세요.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              다시 시도
            </button>
            {/* 루트 레이아웃이 실패한 상태라 클라이언트 라우터 대신 전체 페이지 이동을 쓴다. */}
            <button
              type="button"
              onClick={() => window.location.assign('/')}
              className="rounded-md border border-neutral-border px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              홈으로 이동
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
