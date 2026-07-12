'use client';

import { Trash } from '@phosphor-icons/react';
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
  if (props.status === 'loading') return <p className="py-4 text-sm text-text-secondary">댓글 작성 권한을 확인하고 있습니다…</p>;
  if (props.status === 'error') return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-state-error-subtle px-4 py-4 text-sm text-state-error"><p>로그인 정보를 확인하지 못했습니다.</p><button type="button" className="min-h-11 rounded-lg border border-state-error px-4 font-medium" onClick={() => window.location.reload()}>다시 시도하기</button></div>;
  if (props.status === 'unauthorized') return <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-raised px-4 py-4"><p className="text-sm text-text-secondary">로그인하면 댓글로 이야기에 참여할 수 있습니다.</p><Link href="/login" className="inline-flex min-h-11 items-center rounded-lg border border-neutral-border bg-white px-4 text-sm font-semibold text-text-secondary no-underline hover:no-underline">동문 로그인</Link></div>;
  if (!props.hasAuth) return null;
  return (
    <form onSubmit={props.onSubmit} className="rounded-2xl border border-neutral-border bg-white p-4 focus-within:border-brand-300 sm:p-5">
      <label htmlFor={`comment-${props.postId}`} className="block text-sm font-semibold text-text-primary">댓글로 대화에 참여하기</label>
      <textarea id={`comment-${props.postId}`} value={props.content} onChange={(event) => props.onContentChange(event.target.value)} className="mt-3 min-h-28 w-full resize-y rounded-xl border-0 bg-surface-raised px-4 py-3 text-sm leading-6 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500" rows={3} placeholder="서로를 배려하는 마음으로 댓글을 남겨 주세요." disabled={props.isPending} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-text-muted">따뜻하고 존중하는 대화를 부탁드려요.</p>
        <button type="submit" disabled={props.isPending || !props.content.trim()} className="inline-flex min-h-11 items-center rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white transition hover:bg-brand-800 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:bg-neutral-subtle disabled:text-text-muted">{props.isPending ? '작성 중…' : '댓글 작성'}</button>
      </div>
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

  const { data: comments = [], isLoading, isError, refetch } = useQuery<Comment[]>({
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
    <section className="mt-8 border-t border-neutral-border pt-7 md:mt-10 md:pt-8" aria-labelledby={`comments-title-${postId}`}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={`comments-title-${postId}`} className="text-xl font-semibold tracking-[-0.02em] text-text-primary">
          댓글{' '}
          {!isLoading && !isError ? (
            <span className="text-brand-700">{comments.length}</span>
          ) : (
            <span className="text-text-muted" aria-hidden="true">—</span>
          )}
        </h2>
        <p className="text-xs text-text-muted">동문들과 생각을 나눠 보세요.</p>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="space-y-3" aria-label="댓글을 불러오는 중">
            <div className="h-20 animate-pulse rounded-xl bg-neutral-subtle" />
            <div className="h-20 animate-pulse rounded-xl bg-neutral-subtle" />
          </div>
        ) : isError ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-state-error-subtle px-4 py-5 text-sm text-state-error">
            <p>댓글을 불러오지 못했습니다.</p>
            <button type="button" className="min-h-11 rounded-lg border border-state-error px-4 font-semibold" onClick={() => void refetch()}>다시 불러오기</button>
          </div>
        ) : comments.length === 0 ? (
          <div className="rounded-xl bg-surface-raised px-5 py-7 text-center">
            <p className="font-medium text-text-secondary">아직 댓글이 없습니다.</p>
            <p className="mt-1 text-sm text-text-muted">첫 댓글로 대화를 시작해 보세요.</p>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-border border-y border-neutral-border">
            {comments.map((comment) => {
              const canDelete = auth?.id === comment.author_id || isAdmin;
              return (
                <li key={comment.id} className="py-5">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
                        <span className="font-semibold">{getAuthorName(comment.author_name)}</span>
                        <span aria-hidden="true">·</span>
                        <time dateTime={comment.created_at}>{formatFullDate(comment.created_at)}</time>
                      </div>
                      <p className="whitespace-pre-wrap break-words text-sm leading-7 text-text-primary">{comment.content}</p>
                    </div>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => setDeleteTargetId(comment.id)}
                        disabled={deleteMutation.isPending}
                        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-state-error transition hover:bg-state-error-subtle hover:text-state-error-hover focus-visible:ring-2 focus-visible:ring-state-error disabled:text-text-muted"
                        aria-label={`${getAuthorName(comment.author_name)} 댓글 삭제`}
                      >
                        <Trash aria-hidden="true" size={18} />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-6">
        <CommentComposer postId={postId} status={status} hasAuth={Boolean(auth)} content={content} isPending={createMutation.isPending} onContentChange={setContent} onSubmit={handleSubmit} />
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
    </section>
  );
}
