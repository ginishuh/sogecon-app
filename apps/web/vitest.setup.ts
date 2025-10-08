import '@testing-library/jest-dom';
import React from 'react';
import { vi } from 'vitest';

// Next.js 이미지 컴포넌트 mock — DOM에 유효하지 않은 prop(priority 등)을 제거
vi.mock('next/image', () => ({
  default: ({ priority, placeholder, blurDataURL, fill, ...rest }: any) =>
    React.createElement('img', rest as React.ImgHTMLAttributes<HTMLImageElement>),
}));
