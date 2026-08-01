import { describe, expect, it } from 'vitest';

import {
  getAdminHeroTargetHref,
  getAdminPostPreviewHref,
} from '../lib/post-links';

describe('관리자 게시글 링크', () => {
  it('게시글 preview와 hero target을 관리자 경로로 연결한다', () => {
    expect(getAdminPostPreviewHref(4)).toBe('/admin/posts/4/preview');
    expect(getAdminHeroTargetHref('post', 5)).toBe('/admin/posts/5/preview');
    expect(getAdminHeroTargetHref('event', 6)).toBe('/events/6');
  });
});
