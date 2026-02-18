"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';
import { apiErrorToMessage } from '../lib/error-map';
import { isAdminSession } from '../lib/rbac';
import { deletePost } from '../services/posts';
import { ConfirmDialog } from './confirm-dialog';
import { useToast } from './toast';

type PostAdminActionsProps = {
  postId: number;
  postTitle: string;
};

export function PostAdminActions({ postId, postTitle }: PostAdminActionsProps) {
  const { data: auth } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { show } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => deletePost(postId),
    onSuccess: () => {
      show('게시물이 삭제되었습니다.', { type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['admin-posts'] });
      router.push('/posts');
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError) {
        show(apiErrorToMessage(e.code, e.message), { type: 'error' });
      } else {
        show('삭제 중 오류가 발생했습니다.', { type: 'error' });
      }
    },
  });

  // 관리자가 아니면 렌더링하지 않음
  if (!isAdminSession(auth)) {
    return null;
  }

  return (
    <>
      <div className="flex gap-2">
        <Link
          href={`/admin/posts/${postId}/edit`}
          className="rounded border border-neutral-border px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-raised"
        >
          수정
        </Link>
        <button
          type="button"
          className="rounded border border-state-error-ring px-3 py-1.5 text-sm font-medium text-state-error hover:bg-state-error-subtle"
          onClick={() => setShowDeleteDialog(true)}
        >
          삭제
        </button>
      </div>

      <ConfirmDialog
        open={showDeleteDialog}
        title="게시물 삭제"
        description={`"${postTitle}" 게시물을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없으며, 연관된 댓글도 함께 삭제됩니다.`}
        confirmLabel="삭제"
        variant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setShowDeleteDialog(false)}
      />
    </>
  );
}
