"use client";

import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';

import { ApiError } from '../../../lib/api';
import { createPost } from '../../../services/posts';
import { useAuth } from '../../../hooks/useAuth';

const BOARD_CATEGORY_OPTIONS = [
  { value: 'discussion', label: '자유' },
  { value: 'question', label: '질문' },
  { value: 'share', label: '정보' },
] as const;

export default function BoardNewPage() {
  const { status } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<(typeof BOARD_CATEGORY_OPTIONS)[number]['value']>('discussion');
  const [error, setError] = useState<string | null>(null);

  const mutate = useMutation({
    mutationFn: () =>
      createPost({
        title,
        content,
        category,
      }),
    onSuccess: () => {
      setError(null);
      router.push('/board');
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        if (err.status === 401 || err.status === 403) {
          setError('로그인 후 다시 시도해주세요.');
          return;
        }
        setError(err.message || '게시 중 오류가 발생했습니다.');
      } else {
        setError('알 수 없는 오류가 발생했습니다.');
      }
    },
  });

  const isSubmitting = mutate.isPending;
  const isDisabled = isSubmitting || !title.trim() || !content.trim();

  return (
    <section className="mx-auto w-full max-w-2xl space-y-5 px-6 py-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">새 게시글 작성</h1>
        <p className="text-sm text-slate-600">
          커뮤니티 베타 스켈레톤입니다. 향후 회원 프로필과 연계하여 작성자 정보를 보강합니다.
        </p>
        <Link href="/board" className="text-xs text-slate-500 underline">
          ← 목록으로 돌아가기
        </Link>
      </div>

      {status === 'unauthorized' ? (
        <p className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          로그인 후 게시글을 작성할 수 있습니다. 현재 로그인 정보가 없어 제출 시 오류가 발생할 수 있습니다.
        </p>
      ) : null}

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (isDisabled) return;
          mutate.mutate();
        }}
      >
        <label className="block text-sm text-slate-700">
          제목
          <input
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            placeholder="글 제목을 입력하세요"
            autoComplete="off"
            inputMode="text"
            aria-describedby="title-help"
          />
          <span id="title-help" className="sr-only">게시글 제목</span>
        </label>
        <label className="block text-sm text-slate-700">
          카테고리
          <select
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            value={category}
            onChange={(e) => setCategory(e.currentTarget.value as (typeof BOARD_CATEGORY_OPTIONS)[number]['value'])}
            aria-label="카테고리"
          >
            {BOARD_CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-slate-700">
          내용
          <textarea
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            rows={8}
            value={content}
            onChange={(e) => setContent(e.currentTarget.value)}
            placeholder="커뮤니티 글 내용을 입력하세요"
            inputMode="text"
            autoComplete="off"
            aria-describedby="content-help"
          />
          <span id="content-help" className="sr-only">게시글 본문</span>
        </label>
        <button
          type="submit"
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          disabled={isDisabled}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? '작성 중…' : '작성'}
        </button>
        {error ? <p role="alert" aria-live="polite" className="text-sm text-red-600">{error}</p> : null}
      </form>
    </section>
  );
}
