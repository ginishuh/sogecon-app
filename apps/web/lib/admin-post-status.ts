export type AdminPostPublicationState = 'published' | 'scheduled' | 'draft';

export function getAdminPostPublicationState(
  publishedAt: string | null | undefined,
  now: Date = new Date(),
): AdminPostPublicationState {
  if (!publishedAt) return 'draft';

  const timestamp = Date.parse(publishedAt);
  if (!Number.isFinite(timestamp)) return 'draft';
  return timestamp > now.getTime() ? 'scheduled' : 'published';
}
