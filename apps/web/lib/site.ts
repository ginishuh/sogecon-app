export const siteConfig = {
  name: '서강대 경제대학원 총원우회',
  shortName: '총원우회',
  description:
    '서강대학교 경제대학원 총원우회 공지, 행사, 소개를 통합 제공하는 공식 웹 서비스입니다.',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://alumni.sogang-econ.kr'
} as const;

export const ogImage = {
  path: '/images/og/default-og.svg',
  alt: '서강대 경제대학원 총원우회 대표 이미지'
} as const;
