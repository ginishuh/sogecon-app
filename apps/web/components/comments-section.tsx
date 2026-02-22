'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { createComment, deleteComment, listComments, type Comment } from '../services/comments';
import { formatFullDate } from '../lib/date-utils';
import { useAuth } from '../hooks/useAuth';
import { isAdminSession } from '../lib/rbac';
import { ConfirmDialog } from './confirm-dialog';
import { useToast } from './toast';

interface CommentsSectionProps {
  postId: number;
}

export function CommentsSection({ postId }: CommentsSectionProps) {
  const [content, setContent] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { data: auth } = useAuth();
  const { show: showToast } = useToast();
  const isAdmin = isAdminSession(auth);

  const { data: comments = [], isLoading } = useQuery<Comment[]>({
    queryKey: ['comments', postId],
    queryFn: () => listComments(postId),
  });

  const createMutation = useMutation({
    mutationFn: createComment,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      setContent('');
    },
    onError: () => {
      showToast('댓글 작성에 실패했습니다.', { type: 'error' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteComment,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      setDeleteTargetId(null);
    },
    onError: () => {
      showToast('댓글 삭제에 실패했습니다.', { type: 'error' });
      setDeleteTargetId(null);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      showToast('댓글 내용을 입력해주세요.', { type: 'error' });
      return;
    }
    createMutation.mutate({ post_id: postId, content: content.trim() });
  };

  const handleDeleteConfirm = () => {
    if (deleteTargetId !== null) {
      deleteMutation.mutate(deleteTargetId);
    }
  };

  return (
    <div className="mt-6 border border-neutral-border bg-white">
      {/* 헤더 */}
      <div className="border-b border-neutral-border bg-surface-raised px-6 py-3">
        <h2 className="text-sm font-bold text-text-primary">
          댓글 <span className="text-text-muted">{comments.length}</span>
        </h2>
      </div>

      {/* 댓글 작성 폼 */}
      <div className="border-b border-neutral-border bg-surface-raised px-6 py-4">
        <form onSubmit={handleSubmit}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full rounded border border-neutral-border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            rows={3}
            placeholder="댓글을 입력하세요..."
            disabled={createMutation.isPending}
          />
          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              disabled={createMutation.isPending || !content.trim()}
              className="rounded bg-brand-600 px-4 py-1.5 text-sm text-white hover:bg-brand-700 disabled:bg-neutral-subtle"
            >
              {createMutation.isPending ? '작성 중...' : '댓글 작성'}
            </button>
          </div>
        </form>
      </div>

      {/* 댓글 목록 */}
      <div className="px-6 py-4">
        {isLoading ? (
          <p className="text-center text-sm text-text-muted">댓글을 불러오는 중...</p>
        ) : comments.length === 0 ? (
          <p className="text-center text-sm text-text-muted">아직 댓글이 없습니다.</p>
        ) : (
          <ul className="space-y-4">
            {comments.map((comment) => {
              const canDelete = auth?.id === comment.author_id || isAdmin;
              return (
                <li key={comment.id} className="border-b border-neutral-border pb-4 last:border-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2 text-xs text-text-secondary">
                        <span className="font-semibold">{comment.author_name || `회원${comment.author_id}`}</span>
                        <span>•</span>
                        <span>
                          {formatFullDate(comment.created_at)}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-text-primary">{comment.content}</p>
                    </div>
                    {canDelete && (
                      <button
                        onClick={() => setDeleteTargetId(comment.id)}
                        disabled={deleteMutation.isPending}
                        className="ml-4 text-xs text-state-error hover:text-state-error-hover disabled:text-text-muted"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 댓글 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        open={deleteTargetId !== null}
        title="댓글 삭제"
        description="댓글을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        confirmLabel="삭제"
        variant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
}
