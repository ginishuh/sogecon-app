"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';
import { apiErrorToMessage } from '../lib/error-map';
import { deletePost } from '../services/posts';
import { ConfirmDialog } from './confirm-dialog';
import { useToast } from './toast';

type BoardPostActionsProps = {
  postId: number;
  postTitle: string;
  authorId: number;
};

/** 게시판 글 수정/삭제 버튼 (작성자 본인 또는 관리자만) */
export function BoardPostActions({ postId, postTitle, authorId }: BoardPostActionsProps) {
  const { data: auth } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { show } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => deletePost(postId),
    onSuccess: () => {
      show('게시글이 삭제되었습니다.', { type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['board'] });
      router.push('/board');
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError) {
        show(apiErrorToMessage(e.code, e.message), { type: 'error' });
      } else {
        show('삭제 중 오류가 발생했습니다.', { type: 'error' });
      }
    },
  });

  // 작성자 본인 또는 관리자만 표시
  const isAuthor = auth?.member_id === authorId;
  const isAdmin = auth?.kind === 'admin';
  if (!isAuthor && !isAdmin) {
    return null;
  }

  return (
    <>
      <div className="flex gap-2">
        <Link
          href={`/board/${postId}/edit`}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          수정
        </Link>
        <button
          type="button"
          className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
          onClick={() => setShowDeleteDialog(true)}
        >
          삭제
        </button>
      </div>

      <ConfirmDialog
        open={showDeleteDialog}
        title="게시글 삭제"
        description={`"${postTitle}" 게시글을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        variant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setShowDeleteDialog(false)}
      />
    </>
  );
}
