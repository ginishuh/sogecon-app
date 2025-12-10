"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import { PostForm, type PostFormData } from '../../../../components/post-form';
import { useToast } from '../../../../components/toast';
import { useAuth } from '../../../../hooks/useAuth';
import { ApiError } from '../../../../lib/api';
import { apiErrorToMessage } from '../../../../lib/error-map';
import { getPost, updatePost } from '../../../../services/posts';

export default function BoardEditPage() {
  const { data: auth, status } = useAuth();
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { show } = useToast();

  const postId = Number(params.id);

  const { data: post, isLoading, isError } = useQuery({
    queryKey: ['post', postId],
    queryFn: () => getPost(postId),
    enabled: !Number.isNaN(postId),
  });

  const mutation = useMutation({
    mutationFn: (data: PostFormData) => {
      return updatePost(postId, {
        title: data.title,
        content: data.content,
        category: data.category,
        cover_image: data.cover_image ?? undefined,
        images: data.images.length > 0 ? data.images : undefined,
      });
    },
    onSuccess: () => {
      show('게시글이 수정되었습니다.', { type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['post', postId] });
      void queryClient.invalidateQueries({ queryKey: ['board'] });
      router.push(`/board/${postId}`);
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError) {
        show(apiErrorToMessage(e.code, e.message), { type: 'error' });
      } else {
        show('수정 중 오류가 발생했습니다.', { type: 'error' });
      }
    },
  });

  // 로그인 필요
  if (status !== 'authorized') {
    return <div className="p-6 text-sm text-slate-600">로그인이 필요합니다.</div>;
  }

  // 로딩 중
  if (isLoading) {
    return <div className="p-6 text-sm text-slate-500">로딩 중...</div>;
  }

  // 에러 또는 게시글 없음
  if (isError || !post) {
    return <div className="p-6 text-sm text-red-600">게시글을 불러올 수 없습니다.</div>;
  }

  // 권한 체크: 작성자 본인 또는 관리자만
  const isAuthor = auth?.member_id === post.author_id;
  const isAdmin = auth?.kind === 'admin';
  if (!isAuthor && !isAdmin) {
    return <div className="p-6 text-sm text-red-600">수정 권한이 없습니다.</div>;
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      {/* 브레드크럼 */}
      <nav className="mb-4 text-sm text-slate-600">
        <Link href="/board" className="hover:underline">
          게시판
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/board/${postId}`} className="hover:underline">
          {post.title}
        </Link>
        <span className="mx-2">/</span>
        <span>수정</span>
      </nav>

      <h2 className="mb-6 text-xl font-semibold">게시글 수정</h2>

      <PostForm
        initialData={post}
        submitLabel="수정"
        loadingLabel="수정 중..."
        isPending={mutation.isPending}
        error={mutation.error ? '수정 중 오류가 발생했습니다.' : null}
        onSubmit={(data) => mutation.mutate(data)}
        onCancel={() => router.push(`/board/${postId}`)}
        hideAdminOptions
      />
    </div>
  );
}
