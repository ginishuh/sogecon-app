"use client";

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';

import { AdminAuthState } from '../../../../../components/admin-auth-state';
import { PostDetailContent } from '../../../../../components/post-detail-content';
import { useAuth } from '../../../../../hooks/useAuth';
import { ApiError } from '../../../../../lib/api';
import { postKeys } from '../../../../../lib/query-keys';
import { hasPermissionSession } from '../../../../../lib/rbac';
import { getAdminPostPreview } from '../../../../../services/posts';

function PreviewBody({ postId, showAdminActions }: { postId: number; showAdminActions: boolean }) {
  const query = useQuery({
    queryKey: postKeys.detail(postId),
    queryFn: () => getAdminPostPreview(postId),
    enabled: Number.isFinite(postId),
    retry: false,
  });

  if (query.isLoading) {
    return <div className="p-6 text-sm text-text-secondary">게시물을 불러오는 중...</div>;
  }

  if (query.isError || !query.data) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="mx-auto max-w-3xl space-y-2 p-6 text-sm text-state-error">
        <h1 className="text-lg font-semibold">
          {notFound ? '게시물을 찾을 수 없습니다.' : '게시물을 불러오지 못했습니다.'}
        </h1>
        <p>게시물 관리에서 대상 게시물의 상태를 확인해 주세요.</p>
      </div>
    );
  }

  return (
    <PostDetailContent
      post={query.data}
      backHref="/admin/posts"
      backLabel="← 게시물 관리로 돌아가기"
      showAdminActions={showAdminActions}
    />
  );
}

export default function AdminPostPreviewPage() {
  const { status, data } = useAuth();
  const params = useParams<{ id: string }>();
  const postId = Number(params.id);

  if (status !== 'authorized') {
    return <AdminAuthState status={status} />;
  }

  if (!Number.isFinite(postId)) {
    return <div className="p-6 text-sm text-state-error">잘못된 게시물입니다.</div>;
  }

  const canManagePosts = hasPermissionSession(data, 'admin_posts');
  const canPreview = canManagePosts || hasPermissionSession(data, 'admin_hero');
  if (!canPreview) {
    return <div className="p-6 text-sm text-text-secondary">해당 화면 접근 권한이 없습니다.</div>;
  }

  return <PreviewBody postId={postId} showAdminActions={canManagePosts} />;
}
