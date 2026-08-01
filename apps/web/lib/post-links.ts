import type { Post } from '../services/posts';
import { isBoardCategory } from './community';

type PostLinkInfo = Pick<Post, 'id' | 'category' | 'published_at'>;

type AdminPostPreviewHref = `/admin/posts/${number}/preview`;
type PostDetailHref = `/board/${number}` | `/posts/${number}` | AdminPostPreviewHref;

export function getAdminPostPreviewHref(postId: number): AdminPostPreviewHref {
  return `/admin/posts/${postId}/preview`;
}

export function getAdminHeroTargetHref(
  targetType: 'post' | 'event',
  targetId: number,
): AdminPostPreviewHref | `/events/${number}` {
  return targetType === 'post'
    ? getAdminPostPreviewHref(targetId)
    : `/events/${targetId}`;
}

export function isPublishedPostAt(
  publishedAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!publishedAt) return false;
  const timestamp = Date.parse(publishedAt);
  return Number.isFinite(timestamp) && timestamp <= now.getTime();
}

export function getPostDetailHref(
  post: PostLinkInfo,
  now: Date = new Date(),
): PostDetailHref {
  if (isBoardCategory(post.category)) return `/board/${post.id}`;
  if (isPublishedPostAt(post.published_at, now)) return `/posts/${post.id}`;
  return getAdminPostPreviewHref(post.id);
}
