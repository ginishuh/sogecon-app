import localFont from 'next/font/local';

// 전역 본문/헤딩 공통 폰트 — self-hosted (next/font)
// - Inter(variable) + 시스템 폰트 폴백
// - next/font는 빌드 시 폰트를 프로젝트에 포함하므로 테스트 환경에서도 안전합니다.
export const fontSans = localFont({
  src: [
    {
      path: '../public/fonts/Inter-Variable.woff2',
      style: 'normal',
      // Variable font axis range for CSS. Note: narrowing this range
      // does NOT reduce the font file size for a single variable woff2.
      // To truly reduce bytes, switch to static weights (e.g., 400/500/700)
      // with multiple woff2 files or introduce subsetting.
      weight: '100 900',
    },
  ],
  variable: '--font-sans',
  display: 'swap',
  preload: true,
});

// 메뉴 전용: 시스템 폰트 (서강체 WOFF2 CFF 테이블 오류로 임시 대체)
// TODO: 정상적인 서강체 폰트 파일 구한 후 복구
export const fontMenu = {
  variable: '--font-menu',
  className: '',
};

