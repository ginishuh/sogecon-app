import '@testing-library/jest-dom';
import React from 'react';
import { vi } from 'vitest';

// Next.js 이미지 컴포넌트를 테스트 환경에서 간단히 대체
vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => React.createElement('img', props),
}));
