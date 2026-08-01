import { isBoardCategory } from './community';

export type AdminPostPublicationState = 'published' | 'scheduled' | 'draft';

export function getAdminPostPublicationState(
  category: string | null | undefined,
  publishedAt: string | null | undefined,
  now: Date = new Date(),
): AdminPostPublicationState {
  if (isBoardCategory(category)) return 'published';
  if (!publishedAt) return 'draft';

  const timestamp = Date.parse(publishedAt);
  if (!Number.isFinite(timestamp)) return 'draft';
  return timestamp > now.getTime() ? 'scheduled' : 'published';
}
