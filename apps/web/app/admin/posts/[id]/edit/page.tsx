"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo } from 'react';

import { AdminAuthState } from '../../../../../components/admin-auth-state';
import { HeroTargetToggle } from '../../../../../components/hero-target-toggle';
import { PostForm, type PostFormData } from '../../../../../components/post-form';
import { RequirePermission } from '../../../../../components/require-permission';
import { useToast } from '../../../../../components/toast';
import { useAuth } from '../../../../../hooks/useAuth';
import { useHeroTargetControls } from '../../../../../hooks/useHeroTargetControls';
import { ApiError } from '../../../../../lib/api';
import { apiErrorToMessage } from '../../../../../lib/error-map';
import { isBoardCategory } from '../../../../../lib/community';
import { buildPostUpdatePayload } from '../../../../../lib/post-edit';
import { adminPostKeys, postKeys } from '../../../../../lib/query-keys';
import { hasPermissionSession } from '../../../../../lib/rbac';
import { getAdminPostPreview, updatePost } from '../../../../../services/posts';

function canLoadPost(canManagePosts: boolean, postId: number) {
  return canManagePosts && !Number.isNaN(postId);
}

export default function EditPostPage() {
  const { status, data: session } = useAuth();
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { show } = useToast();
  const canManagePosts = hasPermissionSession(session, 'admin_posts');
  const canManageHero = hasPermissionSession(session, 'admin_hero');

  const postId = Number(params.id);
  const heroTargetIds = useMemo(() => (Number.isFinite(postId) ? [postId] : []), [postId]);
  const heroControls = useHeroTargetControls({
    targetType: 'post',
    targetIds: heroTargetIds,
    showToast: show,
    enabled: canManageHero,
  });

  const { data: post, isLoading, isError } = useQuery({
    queryKey: postKeys.detail(postId),
    queryFn: () => getAdminPostPreview(postId),
    enabled: canLoadPost(canManagePosts, postId),
  });

  const mutation = useMutation({
    mutationFn: (data: PostFormData) => updatePost(postId, buildPostUpdatePayload(data, post, true)),
    onSuccess: () => {
      show('게시물이 수정되었습니다.', { type: 'success' });
      void queryClient.invalidateQueries({ queryKey: postKeys.all });
      void queryClient.invalidateQueries({ queryKey: adminPostKeys.all });
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
    return <AdminAuthState status={status} />;
  }

  return (
    <RequirePermission
      permission="admin_posts"
      fallback={<div className="p-6 text-sm text-text-secondary">해당 화면 접근 권한이 없습니다.</div>}
    >
      <div className="mx-auto max-w-2xl p-6">
        {/* 브레드크럼 */}
        <nav className="mb-4 text-sm text-text-secondary">
          <Link href="/admin/posts" className="hover:underline">
            게시물 관리
          </Link>
          <span className="mx-2">/</span>
          <span>수정</span>
        </nav>

        <h2 className="mb-6 text-xl font-semibold">게시물 수정</h2>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-text-muted">로딩 중...</div>
        ) : isError || !post ? (
          <div className="py-8 text-center text-sm text-state-error">
            게시물을 불러올 수 없습니다.
          </div>
        ) : (
          <>
            {canManageHero && <section className="mb-4 rounded border border-neutral-border bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium text-text-primary">홈 배너</div>
                  <div className="text-xs text-text-muted">
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
            </section>}

            <PostForm
              initialData={post}
              submitLabel="수정"
              loadingLabel="수정 중..."
              isPending={mutation.isPending}
              error={mutation.error ? '수정 중 오류가 발생했습니다.' : null}
              hideCategory={isBoardCategory(post.category) || post.category === 'hero'}
              onSubmit={(data) => mutation.mutate(data)}
              onCancel={() => router.push('/admin/posts')}
            />
          </>
        )}
      </div>
    </RequirePermission>
  );
}
