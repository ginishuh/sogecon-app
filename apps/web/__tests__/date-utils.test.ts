import { describe, expect, it } from 'vitest';

import { formatPostBoardDate, formatPostFullDate, resolvePostDate } from '../lib/date-utils';

describe('게시글 날짜', () => {
  it('관리자 발행 시각을 작성 시각보다 우선한다', () => {
    const published = '2026-07-13T12:00:00+09:00';
    const created = '2026-07-12T12:00:00+09:00';

    expect(resolvePostDate(published, created)).toBe(published);
    expect(formatPostBoardDate(published, created)).toBe('07/13');
  });

  it('일반 동문 글은 작성 시각을 표시한다', () => {
    const created = '2026-07-13T12:00:00+09:00';

    expect(resolvePostDate(null, created)).toBe(created);
    expect(formatPostBoardDate(null, created)).toBe('07/13');
  });

  it('손상된 발행 시각은 작성 시각으로 대체하고 둘 다 없으면 사용자 문구를 쓴다', () => {
    const created = '2026-07-13T12:00:00+09:00';

    expect(resolvePostDate('invalid', created)).toBe(created);
    expect(formatPostFullDate(null, null)).toBe('작성일 미확인');
  });
});
