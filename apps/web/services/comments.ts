import { apiFetch } from '../lib/api';

export type Comment = {
  id: number;
  post_id: number;
  author_id: number;
  author_name?: string | null;
  content: string;
  created_at: string;
};

export type CommentCreate = {
  post_id: number;
  content: string;
};

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
  return apiFetch<void>(`/comments/${commentId}`, {
    method: 'DELETE',
  });
}
