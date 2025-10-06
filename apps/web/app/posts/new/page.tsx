"use client";

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createPost } from '../../../services/posts';
import { ApiError } from '../../../lib/api';
import { apiErrorToMessage } from '../../../lib/error-map';

export default function NewPostPage() {
  const [authorId, setAuthorId] = useState<number | ''>('' as const);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const mutate = useMutation({
    mutationFn: () => createPost({ author_id: Number(authorId), title, content }),
    onSuccess: () => {
      router.push(`/posts`);
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError) setError(apiErrorToMessage(e.code, e.message));
      else setError('알 수 없는 오류');
    }
  });

  return (
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
  );
}
