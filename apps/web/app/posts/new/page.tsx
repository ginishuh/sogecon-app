"use client";

import { useMutation } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

import { MultiImageUpload } from '../../../components/multi-image-upload';
import { RequireAdmin } from '../../../components/require-admin';
import { useToast } from '../../../components/toast';
import { useAuth } from '../../../hooks/useAuth';
import { ApiError } from '../../../lib/api';
import { apiErrorToMessage } from '../../../lib/error-map';
import { createPost } from '../../../services/posts';

export default function NewPostPage() {
  const { status } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { show } = useToast();

  // author_id는 서버에서 세션 기반으로 자동 설정됨
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<'notice' | 'news' | 'hero'>('notice');
  const [pinned, setPinned] = useState(false);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mutate = useMutation({
    mutationFn: () =>
      createPost({
        // author_id는 서버에서 세션 기반으로 강제 주입 (보안)
        title,
        content,
        category,
        pinned,
        cover_image: coverImage ?? undefined,
        images: images.length > 0 ? images : undefined,
      }),
    onSuccess: () => {
      show('게시글이 생성되었습니다.', { type: 'success' });
      router.push('/posts');
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError) {
        const msg = apiErrorToMessage(e.code, e.message);
        setError(msg);
        show(msg, { type: 'error' });
      } else {
        setError('알 수 없는 오류');
        show('알 수 없는 오류', { type: 'error' });
      }
    },
  });

  if (status === 'unauthorized') {
    return (
      <section className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        <h2 className="text-xl font-semibold">새 글 작성</h2>
        <p className="text-sm text-slate-600">
          이 페이지는 관리자만 접근할 수 있습니다.{' '}
          <a className="underline" href={`/login?next=${pathname}`}>
            로그인
          </a>{' '}
          후 이용해주세요.
        </p>
      </section>
    );
  }

  return (
    <RequireAdmin
      fallback={
        <section className="mx-auto max-w-2xl space-y-4 px-4 py-6">
          <h2 className="text-xl font-semibold">새 글 작성</h2>
          <p className="text-sm text-slate-600">관리자 전용입니다.</p>
        </section>
      }
    >
      <section className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <h2 className="text-xl font-semibold">새 글 작성</h2>

        <div className="space-y-4">
          {/* 카테고리 */}
          <label className="block text-sm text-slate-700">
            카테고리
            <select
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={category}
              onChange={(e) => setCategory(e.currentTarget.value as 'notice' | 'news' | 'hero')}
            >
              <option value="notice">공지</option>
              <option value="news">소식</option>
              <option value="hero">히어로 (홈 배너)</option>
            </select>
          </label>

          {/* 제목 */}
          <label className="block text-sm text-slate-700">
            제목
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
              placeholder="글 제목을 입력하세요"
            />
          </label>

          {/* 이미지 업로드 */}
          <div className="space-y-1">
            <span className="block text-sm text-slate-700">
              이미지 {category === 'hero' ? '(필수)' : '(선택)'}
            </span>
            <MultiImageUpload
              coverImage={coverImage}
              images={images}
              onCoverChange={setCoverImage}
              onImagesChange={setImages}
              disabled={mutate.isPending}
              maxImages={category === 'hero' ? 5 : 10}
            />
          </div>

          {/* 내용 */}
          <label className="block text-sm text-slate-700">
            내용
            <textarea
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              rows={8}
              value={content}
              onChange={(e) => setContent(e.currentTarget.value)}
              placeholder="내용을 입력하세요"
            />
          </label>

          {/* 상단 고정 */}
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.currentTarget.checked)}
              className="rounded border-slate-300"
            />
            상단 고정 (PIN)
          </label>

          {/* 에러 메시지 */}
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          {/* 제출 버튼 */}
          <button
            type="button"
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={mutate.isPending || !title || !content}
            onClick={() => mutate.mutate()}
          >
            {mutate.isPending ? '작성 중...' : '작성'}
          </button>
        </div>
      </section>
    </RequireAdmin>
  );
}
