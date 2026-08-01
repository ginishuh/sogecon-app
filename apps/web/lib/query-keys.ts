/** 게시글 React Query key authority (D4 #263). */

export const postKeys = {
  all: ['posts'] as const,
  lists: () => [...postKeys.all, 'list'] as const,
  list: (
    scope: 'home' | 'feed' | 'board',
    params: Record<string, unknown>,
  ) => [...postKeys.lists(), scope, params] as const,
  details: () => [...postKeys.all, 'detail'] as const,
  detail: (id: number) => [...postKeys.details(), id] as const,
};

export const adminPostKeys = {
  all: ['admin-posts'] as const,
  list: (params: unknown) => [...adminPostKeys.all, 'list', params] as const,
};
