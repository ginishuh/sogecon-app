import { splitPinned } from '../lib/posts';

describe('splitPinned', () => {
  it('separates pinned and regular posts', () => {
    const posts = [
      { id: 1, title: 'A', content: '', published_at: null, author_id: 1, pinned: true },
      { id: 2, title: 'B', content: '', published_at: null, author_id: 1, pinned: false },
      { id: 3, title: 'C', content: '', published_at: null, author_id: 1, pinned: true },
    ];
    const { pinned, regular } = splitPinned(posts);
    expect(pinned.map((p) => p.id)).toEqual([1, 3]);
    expect(regular.map((p) => p.id)).toEqual([2]);
  });
});

