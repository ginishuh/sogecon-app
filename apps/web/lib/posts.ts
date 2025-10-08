import type { Post } from '../services/posts';

export function splitPinned(posts: Post[]): { pinned: Post[]; regular: Post[] } {
  const pinned: Post[] = [];
  const regular: Post[] = [];
  for (const post of posts) {
    if (post.pinned) {
      pinned.push(post);
    } else {
      regular.push(post);
    }
  }
  return { pinned, regular };
}

