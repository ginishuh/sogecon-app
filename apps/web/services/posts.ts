// 게시글 도메인 서비스 계층(프런트)
// - 서버 계약과 DTO는 추후 packages/schemas 연동 예정

import { apiFetch } from '../lib/api';

export type Post = {
  id: number;
  title: string;
  content: string;
  published_at: string | null;
  author_id: number;
  author_name?: string | null;
  category?: string | null;
  pinned?: boolean;
  cover_image?: string | null;
  images?: string[] | null;
  view_count?: number;
  comment_count?: number;
};

export async function listPosts(params: { limit?: number; offset?: number; category?: string } = {}): Promise<Post[]> {
  const q = new URLSearchParams();
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.offset != null) q.set('offset', String(params.offset));
  if (params.category) q.set('category', params.category);
  const qs = q.toString();
  return apiFetch<Post[]>(`/posts/${qs ? `?${qs}` : ''}`);
}

export async function getPost(id: number): Promise<Post> {
  return apiFetch<Post>(`/posts/${id}`);
}

export type CreatePostPayload = {
  author_id?: number;
  title: string;
  content: string;
  published_at?: string | null;
  category?: string | null;
  pinned?: boolean;
  cover_image?: string | null;
  images?: string[] | null;
};

export async function createPost(payload: CreatePostPayload): Promise<Post> {
  return apiFetch<Post>(`/posts/`, { method: 'POST', body: JSON.stringify(payload) });
}

export type UpdatePostPayload = {
  title?: string;
  content?: string;
  category?: string | null;
  pinned?: boolean;
  published_at?: string | null;
  cover_image?: string | null;
  images?: string[] | null;
  unpublish?: boolean;
};

export async function updatePost(id: number, payload: UpdatePostPayload): Promise<Post> {
  return apiFetch<Post>(`/posts/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deletePost(id: number): Promise<{ ok: boolean; deleted_id: number }> {
  return apiFetch<{ ok: boolean; deleted_id: number }>(`/posts/${id}`, { method: 'DELETE' });
}

export type AdminPostListParams = {
  limit?: number;
  offset?: number;
  category?: string;
  status?: 'published' | 'draft';
  q?: string;
};

export type AdminPostListResponse = {
  items: Post[];
  total: number;
};

export async function listAdminPosts(params: AdminPostListParams = {}): Promise<AdminPostListResponse> {
  const q = new URLSearchParams();
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.offset != null) q.set('offset', String(params.offset));
  if (params.category) q.set('category', params.category);
  if (params.status) q.set('status', params.status);
  if (params.q) q.set('q', params.q);
  const qs = q.toString();
  return apiFetch<AdminPostListResponse>(`/admin/posts/${qs ? `?${qs}` : ''}`);
}
