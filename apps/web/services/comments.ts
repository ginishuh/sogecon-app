import { apiFetch } from '../lib/api';
import type { Schema } from './_dto';

export type Comment = Schema<'CommentRead'>;
// author_id는 서버가 세션 기반으로 강제하므로 클라이언트에서 제외
export type CommentCreate = Pick<Schema<'CommentCreate'>, 'post_id' | 'content'>;

export async function listComments(postId: number): Promise<Comment[]> {
  return apiFetch<Comment[]>(`/comments/?post_id=${postId}`);
}

export async function createComment(data: CommentCreate): Promise<Comment> {
  return apiFetch<Comment>('/comments/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteComment(commentId: number): Promise<void> {
  return apiFetch(`/comments/${commentId}`, {
    method: 'DELETE',
  });
}
