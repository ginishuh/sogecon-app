import '@testing-library/jest-dom';
import React from 'react';
import { vi } from 'vitest';

// Next.js 이미지 컴포넌트 mock — DOM에 유효하지 않은 prop(priority 등)을 제거
vi.mock('next/image', () => ({
  // 테스트 환경에서 next/image 를 img로 대체하되,
  // DOM에 유효하지 않은 prop은 제거한다.
  default: (props: Record<string, unknown>) => {
    const sanitized = { ...props };
    delete sanitized.priority;
    delete sanitized.placeholder;
    delete sanitized.blurDataURL;
    delete sanitized.fill;
    return React.createElement('img', sanitized as React.ImgHTMLAttributes<HTMLImageElement>);
  },
}));

vi.mock('next/font/local', () => ({
  default: () => ({ variable: '--font-sans' }),
}));

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {
      /* noop */
    },
    removeListener: () => {
      /* noop */
    },
    addEventListener: () => {
      /* noop */
    },
    removeEventListener: () => {
      /* noop */
    },
    dispatchEvent: () => false,
  });
}
