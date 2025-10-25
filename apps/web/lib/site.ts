export const siteConfig = {
  name: '서강대 경제대학원 총동문회',
  shortName: '총동문회',
  description:
    '서강대학교 경제대학원 총동문회 공식 웹 — 공지, 행사, 동문 수첩, FAQ를 한 화면에서 확인하고 동문 네트워크와 바로 연결하세요.',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://alumni.sogang-econ.kr'
} as const;

export const ogImage = {
  path: '/og-default.png',
  alt: '서강대 경제대학원 총동문회 웹 런치 대표 이미지'
} as const;
