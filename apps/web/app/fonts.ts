import localFont from 'next/font/local';

// 전역 본문/헤딩 공통 폰트 — Pretendard Variable (한글+영문)
// - 애플 SF 기반의 현대적인 고딕 폰트
// - next/font는 빌드 시 폰트를 프로젝트에 포함하므로 테스트 환경에서도 안전합니다.
export const fontSans = localFont({
  src: [
    {
      path: '../public/fonts/PretendardVariable.woff2',
      style: 'normal',
      weight: '100 900',
    },
  ],
  variable: '--font-sans',
  display: 'swap',
  preload: true,
});

// 헤더 로고 텍스트용 — KoPubWorld 돋움 볼드
export const fontKopub = localFont({
  src: [
    {
      path: '../public/fonts/KoPubWorldDotumBold.woff2',
      style: 'normal',
      weight: '700',
    },
  ],
  variable: '--font-kopub',
  display: 'swap',
  preload: true, // 헤더에서 바로 보이므로 preload
});

// 서강대 브랜드 폰트 — 공지사항, 인사말, 카드메뉴 등 강조 요소용
export const fontSogang = localFont({
  src: [
    {
      path: '../public/fonts/SogangUniversity.woff2',
      style: 'normal',
      weight: '400',
    },
  ],
  variable: '--font-sogang',
  display: 'swap',
  preload: false, // 주요 폰트가 아니므로 preload 비활성화
});

