type AdminPostPreviewHref = `/admin/posts/${number}/preview`;

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
