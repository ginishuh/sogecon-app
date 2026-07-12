import { describe, expect, it } from 'vitest';

import { getAuthorName, getBoardCategoryInfo, getPostCategoryLabel, isBoardCategory } from '../lib/community';

describe('커뮤니티 사용자 언어', () => {
  it('내부 category를 목적별 사용자 언어로 변환한다', () => {
    expect(getBoardCategoryInfo('discussion').label).toBe('자유게시판');
    expect(getBoardCategoryInfo('share').label).toBe('동문 이야기·행사 후기');
    expect(getPostCategoryLabel('notice')).toBe('공지사항');
    expect(getPostCategoryLabel('news')).toBe('동문 소식');
  });

  it('알 수 없는 category를 공개 라벨로 노출하지 않는다', () => {
    expect(isBoardCategory('internal_value')).toBe(false);
    expect(getBoardCategoryInfo('internal_value')).toBeNull();
    expect(getBoardCategoryInfo('notice')).toBeNull();
    expect(getPostCategoryLabel('internal_value')).toBeNull();
  });

  it('작성자 번호를 조합하지 않고 중립적인 동문 표현을 사용한다', () => {
    expect(getAuthorName('홍길동')).toBe('홍길동');
    expect(getAuthorName(null)).toBe('이름을 공개하지 않은 동문');
    expect(getAuthorName('  ')).toBe('이름을 공개하지 않은 동문');
  });
});
