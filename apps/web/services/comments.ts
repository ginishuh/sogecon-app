import { apiFetch } from '../lib/api';
import type { Schema } from './_dto';

export type Comment = Schema<'CommentRead'>;
export type CommentCreate = Schema<'CommentCreate'>;

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
