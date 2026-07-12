'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { createComment, deleteComment, listComments, type Comment } from '../services/comments';
import { formatFullDate } from '../lib/date-utils';
import { useAuth } from '../hooks/useAuth';
import { isAdminSession } from '../lib/rbac';
import { ConfirmDialog } from './confirm-dialog';
import { useToast } from './toast';
import { getAuthorName } from '../lib/community';

interface CommentsSectionProps {
  postId: number;
}

type CommentComposerProps = {
  postId: number;
  status: 'loading' | 'authorized' | 'unauthorized' | 'error';
  hasAuth: boolean;
  content: string;
  isPending: boolean;
  onContentChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
};

function CommentComposer(props: CommentComposerProps) {
  if (props.status === 'loading') return <p className="text-sm text-text-secondary">댓글 작성 권한을 확인하고 있습니다…</p>;
  if (props.status === 'error') return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 text-sm text-state-error"><p>로그인 정보를 확인하지 못했습니다.</p><button type="button" className="min-h-11 rounded-lg border border-state-error px-4 font-medium" onClick={() => window.location.reload()}>다시 시도하기</button></div>;
  if (props.status === 'unauthorized') return <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-text-secondary">로그인하면 댓글로 이야기에 참여할 수 있습니다.</p><Link href="/login" className="inline-flex min-h-11 items-center rounded-lg border border-neutral-border bg-white px-4 text-sm font-semibold text-text-secondary">동문 로그인</Link></div>;
  if (!props.hasAuth) return null;
  return (
    <form onSubmit={props.onSubmit}>
      <label htmlFor={`comment-${props.postId}`} className="mb-2 block text-sm font-medium text-text-secondary">댓글로 대화에 참여하기</label>
      <textarea id={`comment-${props.postId}`} value={props.content} onChange={(event) => props.onContentChange(event.target.value)} className="w-full rounded border border-neutral-border px-3 py-3 text-sm focus:border-brand-500 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500" rows={3} placeholder="서로를 배려하는 마음으로 댓글을 남겨 주세요." disabled={props.isPending} />
      <div className="mt-2 flex justify-end"><button type="submit" disabled={props.isPending || !props.content.trim()} className="min-h-11 rounded bg-brand-600 px-4 text-sm text-white hover:bg-brand-700 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:bg-neutral-subtle">{props.isPending ? '작성 중...' : '댓글 작성'}</button></div>
    </form>
  );
}

export function CommentsSection({ postId }: CommentsSectionProps) {
  const [content, setContent] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { data: auth, status } = useAuth();
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
      showToast('댓글을 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.', { type: 'error' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteComment,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      setDeleteTargetId(null);
    },
    onError: () => {
      showToast('댓글을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.', { type: 'error' });
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
        <CommentComposer postId={postId} status={status} hasAuth={Boolean(auth)} content={content} isPending={createMutation.isPending} onContentChange={setContent} onSubmit={handleSubmit} />
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
                        <span className="font-semibold">{getAuthorName(comment.author_name)}</span>
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
                        className="ml-4 min-h-11 min-w-11 rounded-lg px-2 text-sm text-state-error hover:bg-state-error-subtle hover:text-state-error-hover focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-state-error disabled:text-text-muted"
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
