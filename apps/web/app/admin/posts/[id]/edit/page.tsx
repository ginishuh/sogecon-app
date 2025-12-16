"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo } from 'react';

import { HeroTargetToggle } from '../../../../../components/hero-target-toggle';
import { PostForm, type PostFormData } from '../../../../../components/post-form';
import { RequireAdmin } from '../../../../../components/require-admin';
import { useToast } from '../../../../../components/toast';
import { useAuth } from '../../../../../hooks/useAuth';
import { useHeroTargetControls } from '../../../../../hooks/useHeroTargetControls';
import { ApiError } from '../../../../../lib/api';
import { apiErrorToMessage } from '../../../../../lib/error-map';
import { getPost, updatePost, type UpdatePostPayload } from '../../../../../services/posts';

export default function EditPostPage() {
  const { status } = useAuth();
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { show } = useToast();

  const postId = Number(params.id);
  const heroTargetIds = useMemo(() => (Number.isFinite(postId) ? [postId] : []), [postId]);
  const heroControls = useHeroTargetControls({ targetType: 'post', targetIds: heroTargetIds, showToast: show });

  const { data: post, isLoading, isError } = useQuery({
    queryKey: ['post', postId],
    queryFn: () => getPost(postId),
    enabled: !Number.isNaN(postId),
  });

  const mutation = useMutation({
    mutationFn: (data: PostFormData) => {
      const wasPublished = !!post?.published_at;
      const wantPublished = data.published;

      // 공개 상태 변경 로직:
      // - 공개→공개: published_at 변경 없음 (필드 안 보냄)
      // - 공개→비공개: unpublish: true
      // - 비공개→공개: published_at 설정
      // - 비공개→비공개: 변경 없음
      let publishPayload: { published_at?: string; unpublish?: boolean } = {};
      if (wasPublished && !wantPublished) {
        publishPayload = { unpublish: true };
      } else if (!wasPublished && wantPublished) {
        publishPayload = { published_at: new Date().toISOString() };
      }

      const payload: UpdatePostPayload = {
        title: data.title,
        content: data.content,
        category: post?.category === 'hero' ? undefined : data.category,
        pinned: data.pinned,
        cover_image: data.cover_image ?? undefined,
        images: data.images.length > 0 ? data.images : undefined,
        ...publishPayload,
      };

      return updatePost(postId, payload);
    },
    onSuccess: () => {
      show('게시물이 수정되었습니다.', { type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['post', postId] });
      void queryClient.invalidateQueries({ queryKey: ['admin-posts'] });
      router.push('/admin/posts');
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError) {
        show(apiErrorToMessage(e.code, e.message), { type: 'error' });
      } else {
        show('수정 중 오류가 발생했습니다.', { type: 'error' });
      }
    },
  });

  if (status !== 'authorized') {
    return <div className="p-6 text-sm text-slate-600">관리자 로그인이 필요합니다.</div>;
  }

  return (
    <RequireAdmin fallback={<div className="p-6 text-sm text-slate-600">관리자 전용입니다.</div>}>
      <div className="mx-auto max-w-2xl p-6">
        {/* 브레드크럼 */}
        <nav className="mb-4 text-sm text-slate-600">
          <Link href="/admin/posts" className="hover:underline">
            게시물 관리
          </Link>
          <span className="mx-2">/</span>
          <span>수정</span>
        </nav>

        <h2 className="mb-6 text-xl font-semibold">게시물 수정</h2>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-slate-500">로딩 중...</div>
        ) : isError || !post ? (
          <div className="py-8 text-center text-sm text-red-600">
            게시물을 불러올 수 없습니다.
          </div>
        ) : (
          <>
            <section className="mb-4 rounded border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium text-slate-900">홈 배너</div>
                  <div className="text-xs text-slate-500">
                    게시물 관리 목록에서도 지정할 수 있습니다.
                  </div>
                </div>
                <HeroTargetToggle
                  value={heroControls.heroById.get(postId)}
                  isPending={heroControls.isPending}
                  onToggle={(nextOn) => heroControls.toggleHero(postId, nextOn)}
                  onTogglePinned={(nextPinned) => heroControls.togglePinned(postId, nextPinned)}
                />
              </div>
            </section>

            <PostForm
              initialData={post}
              submitLabel="수정"
              loadingLabel="수정 중..."
              isPending={mutation.isPending}
              error={mutation.error ? '수정 중 오류가 발생했습니다.' : null}
              hideCategory={post.category === 'hero'}
              onSubmit={(data) => mutation.mutate(data)}
              onCancel={() => router.push('/admin/posts')}
            />
          </>
        )}
      </div>
    </RequireAdmin>
  );
}
