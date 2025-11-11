'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { createComment, deleteComment, listComments, type Comment } from '../services/comments';

interface CommentsSectionProps {
  postId: number;
}

export function CommentsSection({ postId }: CommentsSectionProps) {
  const [content, setContent] = useState('');
  const queryClient = useQueryClient();

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
    onError: (error) => {
      alert('댓글 작성에 실패했습니다: ' + error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteComment,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['comments', postId] });
    },
    onError: (error) => {
      alert('댓글 삭제에 실패했습니다: ' + error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      alert('댓글 내용을 입력해주세요.');
      return;
    }
    createMutation.mutate({ post_id: postId, content: content.trim() });
  };

  const handleDelete = (commentId: number) => {
    if (confirm('댓글을 삭제하시겠습니까?')) {
      deleteMutation.mutate(commentId);
    }
  };

  return (
    <div className="mt-6 border border-slate-300 bg-white">
      {/* 헤더 */}
      <div className="border-b border-slate-300 bg-slate-50 px-6 py-3">
        <h2 className="text-sm font-bold text-slate-900">
          댓글 <span className="text-slate-500">{comments.length}</span>
        </h2>
      </div>

      {/* 댓글 작성 폼 */}
      <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
        <form onSubmit={handleSubmit}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            rows={3}
            placeholder="댓글을 입력하세요..."
            disabled={createMutation.isPending}
          />
          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              disabled={createMutation.isPending || !content.trim()}
              className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:bg-slate-300"
            >
              {createMutation.isPending ? '작성 중...' : '댓글 작성'}
            </button>
          </div>
        </form>
      </div>

      {/* 댓글 목록 */}
      <div className="px-6 py-4">
        {isLoading ? (
          <p className="text-center text-sm text-slate-500">댓글을 불러오는 중...</p>
        ) : comments.length === 0 ? (
          <p className="text-center text-sm text-slate-500">아직 댓글이 없습니다.</p>
        ) : (
          <ul className="space-y-4">
            {comments.map((comment) => (
              <li key={comment.id} className="border-b border-slate-100 pb-4 last:border-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2 text-xs text-slate-600">
                      <span className="font-semibold">{comment.author_name || `회원${comment.author_id}`}</span>
                      <span>•</span>
                      <span>
                        {new Date(comment.created_at).toLocaleString('ko-KR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-slate-800">{comment.content}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(comment.id)}
                    disabled={deleteMutation.isPending}
                    className="ml-4 text-xs text-red-600 hover:text-red-800 disabled:text-slate-400"
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
