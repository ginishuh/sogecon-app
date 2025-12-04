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
