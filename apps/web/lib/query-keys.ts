/** 게시글 React Query key authority (#263). */

import type { ListPostsParams } from '../services/posts';

export function normalizeListPostsParams(
  params: ListPostsParams,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  if (params.limit != null) {
    normalized.limit = params.limit;
  }
  if (params.offset != null) {
    normalized.offset = params.offset;
  }

  const query = params.q?.trim();
  if (query) {
    normalized.q = query;
  }

  if (params.categories && params.categories.length > 0) {
    normalized.categories = [...params.categories].sort();
  } else if (params.category) {
    normalized.category = params.category;
  }

  return normalized;
}

export const postKeys = {
  all: ['posts'] as const,
  lists: () => [...postKeys.all, 'list'] as const,
  list: (params: ListPostsParams) =>
    [...postKeys.lists(), normalizeListPostsParams(params)] as const,
  infiniteLists: () => [...postKeys.all, 'infinite-list'] as const,
  infiniteList: (params: ListPostsParams) =>
    [...postKeys.infiniteLists(), normalizeListPostsParams(params)] as const,
  details: () => [...postKeys.all, 'detail'] as const,
  publicDetail: (id: number) => [...postKeys.details(), 'public', id] as const,
};

export const adminPostKeys = {
  all: ['admin-posts'] as const,
  list: (params: unknown) => [...adminPostKeys.all, 'list', params] as const,
  previews: () => [...adminPostKeys.all, 'preview'] as const,
  preview: (id: number) => [...adminPostKeys.previews(), id] as const,
};
