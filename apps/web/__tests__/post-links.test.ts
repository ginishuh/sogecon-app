import { describe, expect, it } from 'vitest';

import {
  getAdminHeroTargetHref,
  getAdminPostPreviewHref,
  getPostDetailHref,
} from '../lib/post-links';

describe('게시글 링크 경계', () => {
  it('board 글은 board 상세로 연결한다', () => {
    expect(
      getPostDetailHref({ id: 1, category: 'discussion', published_at: null }),
    ).toBe('/board/1');
  });

  it('발행된 notice/news는 공개 상세로 연결한다', () => {
    expect(
      getPostDetailHref({ id: 2, category: 'notice', published_at: '2026-08-01T00:00:00Z' }),
    ).toBe('/posts/2');
  });

  it('draft는 관리자 preview로 연결한다', () => {
    expect(getPostDetailHref({ id: 3, category: 'news', published_at: null })).toBe(
      '/admin/posts/3/preview',
    );
    expect(getAdminPostPreviewHref(4)).toBe('/admin/posts/4/preview');
    expect(getAdminHeroTargetHref('post', 5)).toBe('/admin/posts/5/preview');
    expect(getAdminHeroTargetHref('event', 6)).toBe('/events/6');
  });
});
