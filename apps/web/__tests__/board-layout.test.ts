import { describe, expect, it } from 'vitest';

import { isPublicBoardPath } from '../app/board/layout';

describe('게시판 인증 경계', () => {
  it('비회원 복구 화면이 있는 새 글 경로만 공개한다', () => {
    expect(isPublicBoardPath('/board/new')).toBe(true);
    expect(isPublicBoardPath('/board')).toBe(false);
    expect(isPublicBoardPath('/board/13')).toBe(false);
    expect(isPublicBoardPath('/board/13/edit')).toBe(false);
  });
});
