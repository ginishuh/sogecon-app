"use client";

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { PostForm, type PostFormData } from '../../../../components/post-form';
import { RequireAdmin } from '../../../../components/require-admin';
import { useToast } from '../../../../components/toast';
import { useAuth } from '../../../../hooks/useAuth';
import { ApiError } from '../../../../lib/api';
import { apiErrorToMessage } from '../../../../lib/error-map';
import { createPost } from '../../../../services/posts';

function toCreatePayload(data: PostFormData) {
  return {
    title: data.title,
    content: data.content,
    category: data.category,
    pinned: data.pinned,
    cover_image: data.cover_image ?? undefined,
    images: data.images.length > 0 ? data.images : undefined,
    published_at: data.published ? new Date().toISOString() : null,
  };
}

export default function AdminNewPostPage() {
  const { status } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { show } = useToast();

  const mutation = useMutation({
    mutationFn: (data: PostFormData) => createPost(toCreatePayload(data)),
    onSuccess: () => {
      show('게시물이 생성되었습니다.', { type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['admin-posts'] });
      void queryClient.invalidateQueries({ queryKey: ['posts'] });
      router.push('/admin/posts');
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError) {
        show(apiErrorToMessage(e.code, e.message), { type: 'error' });
      } else {
        show('생성 중 오류가 발생했습니다.', { type: 'error' });
      }
    },
  });

  if (status !== 'authorized') {
    return <div className="p-6 text-sm text-text-secondary">관리자 로그인이 필요합니다.</div>;
  }

  return (
    <RequireAdmin fallback={<div className="p-6 text-sm text-text-secondary">관리자 전용입니다.</div>}>
      <div className="mx-auto max-w-2xl p-6">
        <nav className="mb-4 text-sm text-text-secondary">
          <Link href="/admin/posts" className="hover:underline">
            게시물 관리
          </Link>
          <span className="mx-2">/</span>
          <span>새 글</span>
        </nav>

        <h2 className="mb-6 text-xl font-semibold">새 글 작성</h2>

        <PostForm
          submitLabel="생성"
          loadingLabel="생성 중..."
          isPending={mutation.isPending}
          error={mutation.error ? '생성 중 오류가 발생했습니다.' : null}
          onSubmit={(data) => mutation.mutate(data)}
          onCancel={() => router.push('/admin/posts')}
        />
      </div>
    </RequireAdmin>
  );
}

