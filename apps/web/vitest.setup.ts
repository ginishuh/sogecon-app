import '@testing-library/jest-dom';
import React from 'react';
import { vi } from 'vitest';

// Next.js 이미지 컴포넌트 mock — DOM에 유효하지 않은 prop(priority 등)을 제거
vi.mock('next/image', () => ({
  // 테스트 환경에서 next/image 를 img로 대체하되,
  // DOM에 유효하지 않은 prop은 제거한다.
  default: (props: Record<string, unknown>) => {
    const { priority, placeholder, blurDataURL, fill, ...rest } = props;
    return React.createElement('img', rest as React.ImgHTMLAttributes<HTMLImageElement>);
  },
}));

// next/font — 테스트 환경 모킹(빌드 시에만 실제 폰트 로더 사용)
vi.mock('next/font/google', () => ({
  Inter: () => ({ variable: '--font-sans' }),
}));

vi.mock('next/font/local', () => ({
  default: () => ({ variable: '--font-sans' }),
}));
