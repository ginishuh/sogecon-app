import { describe, expect, it } from 'vitest';

import { adminPostKeys, normalizeListPostsParams, postKeys } from '../lib/query-keys';

describe('normalizeListPostsParams', () => {
  it('uses categories array for multi-category list requests', () => {
    expect(
      normalizeListPostsParams({
        limit: 20,
        categories: ['news', 'notice'],
      }),
    ).toEqual({
      limit: 20,
      categories: ['news', 'notice'],
    });
  });

  it('treats identical API params the same regardless of caller screen', () => {
    const home = normalizeListPostsParams({ category: 'notice', limit: 5 });
    const feed = normalizeListPostsParams({ category: 'notice', limit: 5 });
    expect(home).toEqual(feed);
    expect(postKeys.list({ category: 'notice', limit: 5 })).toEqual(
      postKeys.list({ category: 'notice', limit: 5 }),
    );
  });

  it('does not encode UI-only category=all when API uses categories', () => {
    const boardAll = normalizeListPostsParams({
      limit: 10,
      categories: ['congrats', 'discussion', 'question', 'share'],
    });
    expect(boardAll).toEqual({
      limit: 10,
      categories: ['congrats', 'discussion', 'question', 'share'],
    });
    expect(boardAll).not.toHaveProperty('category');
  });
});

describe('postKeys authority boundaries', () => {
  it('separates public detail from admin preview keys', () => {
    expect(postKeys.publicDetail(42)).toEqual(['posts', 'detail', 'public', 42]);
    expect(adminPostKeys.preview(42)).toEqual(['admin-posts', 'preview', 42]);
    expect(postKeys.publicDetail(42)).not.toEqual(adminPostKeys.preview(42));
  });

  it('uses API params for infinite list keys without page offset', () => {
    expect(
      postKeys.infiniteList({
        limit: 10,
        categories: ['congrats', 'discussion', 'question', 'share'],
        q: 'hello',
      }),
    ).toEqual([
      'posts',
      'infinite-list',
      {
        limit: 10,
        q: 'hello',
        categories: ['congrats', 'discussion', 'question', 'share'],
      },
    ]);
  });
});
