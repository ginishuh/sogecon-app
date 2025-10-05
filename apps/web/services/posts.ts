// 게시글 도메인 서비스 계층(프런트)
// - 서버 계약과 DTO는 추후 packages/schemas 연동 예정

import { apiFetch } from '../lib/api';

export type Post = {
  id: number;
  title: string;
  content: string;
  published_at: string | null;
  author_id: number;
};

export async function listPosts(params: { limit?: number; offset?: number } = {}): Promise<Post[]> {
  const q = new URLSearchParams();
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.offset != null) q.set('offset', String(params.offset));
  const qs = q.toString();
  return apiFetch<Post[]>(`/posts${qs ? `?${qs}` : ''}`);
}

