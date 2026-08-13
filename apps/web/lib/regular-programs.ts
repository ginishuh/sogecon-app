import type { Route } from 'next';

export type RegularProgram = {
  href: Route;
  title: string;
  summary: string;
};

export const SOGANG_ECONOMICS_AWARD_HREF =
  '/about/programs/sogang-economics-award' as const satisfies Route;

export const REGULAR_PROGRAMS: readonly RegularProgram[] = [
  {
    href: SOGANG_ECONOMICS_AWARD_HREF,
    title: '서강경제대상',
    summary:
      '경제대학원과 총동문회가 해마다 교수와 동문에게 수여하는 상입니다. 시상 일정은 그때그때 달라지므로 행사 일정에서 확인하세요.',
  },
];

export type EconomicsAwardLaureate = {
  year: number;
  edition: number;
  faculty: string;
  alumni: string;
};

/** 서강경제대상 최근 수상자. */
export const SOGANG_ECONOMICS_AWARD_LAUREATES: readonly EconomicsAwardLaureate[] = [
  {
    year: 2025,
    edition: 15,
    faculty: '이강오 서강대 경제학부 교수',
    alumni: '신명식 아빅스코리아 대표',
  },
  {
    year: 2024,
    edition: 14,
    faculty: '이영훈 서강대 경제학부 교수',
    alumni: '유동열 회룡건설 대표',
  },
  {
    year: 2023,
    edition: 13,
    faculty: '왕규호 서강대 경제학부 교수',
    alumni: '임동순 NH아문디자산운용 대표',
  },
  {
    year: 2022,
    edition: 12,
    faculty: '곽노선 서강대 경제학부 교수',
    alumni: '이완직 미도리얼코 대표',
  },
];
