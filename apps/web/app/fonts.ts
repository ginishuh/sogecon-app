import localFont from 'next/font/local';

// 전역 본문/헤딩 공통 폰트 — self-hosted (next/font)
// - Inter(variable) + 시스템 폰트 폴백
// - next/font는 빌드 시 폰트를 프로젝트에 포함하므로 테스트 환경에서도 안전합니다.
export const fontSans = localFont({
  src: [
    {
      path: '../public/fonts/Inter-Variable.woff2',
      style: 'normal',
      weight: '100 900',
    },
  ],
  variable: '--font-sans',
  display: 'swap',
  preload: true,
});
