import { describe, expect, it } from 'vitest';

import { buildBoardPostOwnerUpdatePayload, buildPostUpdatePayload } from '../lib/post-edit';

const formData = {
  title: '수정 제목',
  content: '수정 본문',
  category: 'notice' as const,
  pinned: false,
  cover_image: null,
  images: [],
  published: false,
};

describe('게시글 수정 payload', () => {
  it('관리자가 board 글을 수정해도 category를 notice로 덮어쓰지 않는다', () => {
    const payload = buildPostUpdatePayload(
      formData,
      { category: 'discussion', published_at: null },
      true,
    );

    expect(payload).not.toHaveProperty('category');
    expect(payload).not.toHaveProperty('published_at');
    expect(payload).not.toHaveProperty('unpublish');
  });

  it('관리자가 board 글을 공개로 선택해도 published_at을 만들지 않는다', () => {
    const payload = buildPostUpdatePayload(
      { ...formData, published: true },
      { category: 'discussion', published_at: null },
      true,
    );

    expect(payload).not.toHaveProperty('category');
    expect(payload).not.toHaveProperty('published_at');
    expect(payload).not.toHaveProperty('unpublish');
    expect(payload.pinned).toBe(false);
  });

  it('관리자가 notice/news 글을 수정하면 선택한 category를 보낸다', () => {
    const payload = buildPostUpdatePayload(
      formData,
      { category: 'notice', published_at: '2026-08-01T00:00:00Z' },
      true,
    );

    expect(payload.category).toBe('notice');
    expect(payload.unpublish).toBe(true);
  });

  it('owner payload는 관리자 필드를 만들지 않고 이미지 제거 값을 보존한다', () => {
    const payload = buildBoardPostOwnerUpdatePayload({
      ...formData,
      cover_image: null,
      images: [],
    });

    expect(payload).toEqual({
      title: '수정 제목',
      content: '수정 본문',
      cover_image: null,
      images: [],
    });
    expect(payload).not.toHaveProperty('category');
    expect(payload).not.toHaveProperty('published_at');
    expect(payload).not.toHaveProperty('pinned');
    expect(payload).not.toHaveProperty('unpublish');
  });
});
