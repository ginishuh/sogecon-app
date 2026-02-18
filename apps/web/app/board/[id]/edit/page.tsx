"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import { PostForm, type PostFormData } from '../../../../components/post-form';
import { useToast } from '../../../../components/toast';
import { useAuth } from '../../../../hooks/useAuth';
import { ApiError } from '../../../../lib/api';
import { apiErrorToMessage } from '../../../../lib/error-map';
import { isAdminSession } from '../../../../lib/rbac';
import { getPost, updatePost, type Post } from '../../../../services/posts';

/** 상태 메시지 컴포넌트 */
function StatusMessage({ text, error = false }: { text: string; error?: boolean }) {
  const color = error ? 'text-state-error' : 'text-text-muted';
  return <div className={`p-6 text-sm ${color}`}>{text}</div>;
}

/** mutation 에러 핸들러 (복잡도 분리) */
function createErrorHandler(
  show: (msg: string, opts?: { type?: 'success' | 'info' | 'error'; durationMs?: number }) => void
) {
  return (e: unknown) => {
    if (e instanceof ApiError) {
      show(apiErrorToMessage(e.code, e.message), { type: 'error' });
    } else {
      show('수정 중 오류가 발생했습니다.', { type: 'error' });
    }
  };
}

/** 에러 메시지 반환 (복잡도 분리) */
function getErrorMessage(error: unknown): string | null {
  return error ? '수정 중 오류가 발생했습니다.' : null;
}

/** 수정 요청 payload 생성 (복잡도 분리) */
function buildUpdatePayload(
  data: PostFormData,
  post: Post | undefined,
  isAdmin: boolean
): Parameters<typeof updatePost>[1] {
  const payload: Parameters<typeof updatePost>[1] = {
    title: data.title,
    content: data.content,
    cover_image: data.cover_image ?? undefined,
    images: data.images.length > 0 ? data.images : undefined,
  };
  if (!isAdmin) return payload;

  // 관리자만 카테고리/공개/핀 수정 가능
  payload.category = data.category;
  payload.pinned = data.pinned;
  // 공개 상태 변경 로직
  const wasPublished = !!post?.published_at;
  if (wasPublished && !data.published) {
    payload.unpublish = true;
  } else if (!wasPublished && data.published) {
    payload.published_at = new Date().toISOString();
  }
  return payload;
}

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

  // 권한 체크용 (mutation 내에서 사용)
  const isAdmin = isAdminSession(auth);

  const mutation = useMutation({
    mutationFn: (data: PostFormData) => updatePost(postId, buildUpdatePayload(data, post, isAdmin)),
    onSuccess: () => {
      show('게시글이 수정되었습니다.', { type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['post', postId] });
      void queryClient.invalidateQueries({ queryKey: ['board'] });
      router.push(`/board/${postId}`);
    },
    onError: createErrorHandler(show),
  });

  // 인증 상태 로딩 중
  if (status === 'loading') return <StatusMessage text="로딩 중..." />;
  // 미로그인
  if (status === 'unauthorized') return <StatusMessage text="로그인이 필요합니다." />;
  // 게시글 로딩 중
  if (isLoading) return <StatusMessage text="게시글 로딩 중..." />;
  // 에러 또는 게시글 없음
  if (isError || !post) return <StatusMessage text="게시글을 불러올 수 없습니다." error />;
  // 권한 체크: 작성자 본인 또는 관리자만
  const canEdit = auth?.id === post.author_id || isAdmin;
  if (!canEdit) return <StatusMessage text="수정 권한이 없습니다." error />;

  return (
    <div className="mx-auto max-w-2xl p-6">
      {/* 브레드크럼 */}
      <nav className="mb-4 text-sm text-text-secondary">
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
        error={getErrorMessage(mutation.error)}
        onSubmit={(data) => mutation.mutate(data)}
        onCancel={() => router.push(`/board/${postId}`)}
        hideAdminOptions={!isAdmin}
      />
    </div>
  );
}
