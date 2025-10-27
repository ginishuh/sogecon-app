"use client";

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createPost } from '../../../services/posts';
import { ApiError } from '../../../lib/api';
import { apiErrorToMessage } from '../../../lib/error-map';
import { useToast } from '../../../components/toast';
import { useAuth } from '../../../hooks/useAuth';
import { RequireAdmin } from '../../../components/require-admin';
import { usePathname } from 'next/navigation';

export default function NewPostPage() {
  const { status } = useAuth();
  const pathname = usePathname();
  const [authorId, setAuthorId] = useState<number | ''>('' as const);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<'notice'|'news'|'hero'>('notice');
  const [pinned, setPinned] = useState(false);
  const [coverImage, setCoverImage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { show } = useToast();

  const mutate = useMutation({
    mutationFn: () => createPost({
      author_id: Number(authorId),
      title,
      content,
      category,
      pinned,
      cover_image: coverImage || undefined,
    }),
    onSuccess: () => {
      show('게시글이 생성되었습니다.', { type: 'success' });
      router.push(`/posts`);
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
    }
  });

  if (status === 'unauthorized') {
    return (
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">게시글 작성</h2>
        <p className="text-sm text-slate-600">
          이 페이지는 관리자만 접근할 수 있습니다. <a className="underline" href={`/login?next=${pathname}`}>로그인</a> 후 이용해주세요.
        </p>
      </section>
    );
  }

  return (
    <RequireAdmin fallback={
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">게시글 작성</h2>
        <p className="text-sm text-slate-600">관리자 전용입니다.</p>
      </section>
    }>
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">게시글 작성</h2>
      <div className="space-y-3">
        <label className="block text-sm">
          작성자 ID
          <input
            className="mt-1 w-40 rounded border px-2 py-1"
            type="number"
            value={authorId}
            onChange={(e) => setAuthorId(e.currentTarget.value === '' ? '' : Number(e.currentTarget.value))}
          />
        </label>
        <label className="block text-sm">
          제목
          <input className="mt-1 w-full rounded border px-2 py-1" value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
        </label>
        <label className="block text-sm">
          내용
          <textarea className="mt-1 w-full rounded border px-2 py-1" rows={6} value={content} onChange={(e) => setContent(e.currentTarget.value)} />
        </label>
        <label className="block text-sm">
          카테고리
          <select className="mt-1 rounded border px-2 py-1" value={category} onChange={(e) => setCategory(e.currentTarget.value as 'notice'|'news'|'hero')}>
            <option value="notice">공지</option>
            <option value="news">소식</option>
            <option value="hero">히어로(홈 배너)</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.currentTarget.checked)} />
          상단 고정(PIN)
        </label>
        <label className="block text-sm">
          커버 이미지 URL
          <input className="mt-1 w-full rounded border px-2 py-1" value={coverImage} onChange={(e) => setCoverImage(e.currentTarget.value)} />
        </label>
        <button
          className="rounded bg-slate-900 px-3 py-1 text-white disabled:opacity-50"
          disabled={mutate.isPending || typeof authorId !== 'number' || !title || !content}
          onClick={() => mutate.mutate()}
        >
          작성
        </button>
        {error && <p className="text-red-700 text-sm">{error}</p>}
      </div>
    </section>
    </RequireAdmin>
  );
}
