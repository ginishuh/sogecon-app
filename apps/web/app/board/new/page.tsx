"use client";

import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';

import { ImageUpload } from '../../../components/image-upload';
import { useAuth } from '../../../hooks/useAuth';
import { ApiError } from '../../../lib/api';
import { createPost } from '../../../services/posts';
import { getBoardCategoryInfo } from '../../../lib/community';

const BOARD_CATEGORY_OPTIONS = [
  { value: 'discussion', label: '자유게시판' },
  { value: 'question', label: '묻고 답하기' },
  { value: 'share', label: '동문 이야기·행사 후기' },
  { value: 'congrats', label: '경조사' },
] as const;

export default function BoardNewPage() {
  const { status } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<(typeof BOARD_CATEGORY_OPTIONS)[number]['value']>('discussion');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutate = useMutation({
    mutationFn: () =>
      createPost({
        title,
        content,
        category,
        cover_image: coverImage,
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
  const categoryInfo = getBoardCategoryInfo(category);

  if (status === 'loading') {
    return <p className="mx-auto max-w-2xl px-6 py-10 text-sm text-text-secondary">로그인 정보를 확인하고 있습니다…</p>;
  }

  if (status === 'unauthorized') {
    return (
      <section className="mx-auto max-w-2xl space-y-5 px-6 py-10 text-center">
        <p className="text-sm font-medium text-brand-700">동문 커뮤니티</p>
        <h1 className="text-2xl font-semibold text-text-primary">로그인 후 이야기를 남길 수 있어요</h1>
        <p className="text-sm leading-6 text-text-secondary">게시글은 확인된 동문만 작성할 수 있습니다. 로그인한 뒤 다시 글쓰기를 선택해 주세요.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/login" className="inline-flex min-h-11 items-center rounded-lg bg-brand-primary px-5 font-semibold text-white">동문 로그인</Link>
          <Link href="/board" className="inline-flex min-h-11 items-center rounded-lg border border-neutral-border px-5 font-semibold text-text-secondary">게시판으로 돌아가기</Link>
        </div>
      </section>
    );
  }

  if (status === 'error') {
    return (
      <section className="mx-auto max-w-2xl space-y-4 px-6 py-10 text-center">
        <h1 className="text-2xl font-semibold text-text-primary">로그인 정보를 확인하지 못했습니다</h1>
        <p className="text-sm text-text-secondary">페이지를 새로고침한 뒤 다시 시도해 주세요. 문제가 계속되면 동문회 사무국에 문의해 주세요.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/board/new" className="inline-flex min-h-11 items-center rounded-lg bg-brand-primary px-5 font-semibold text-white">다시 시도하기</Link>
          <Link href="/support/contact" className="inline-flex min-h-11 items-center rounded-lg border border-neutral-border px-5 font-semibold text-text-secondary">사무국에 문의하기</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-2xl space-y-5 px-6 py-6">
      <div className="space-y-1">
        <p className="text-sm font-medium text-brand-700">동문 커뮤니티</p>
        <h1 className="text-2xl font-semibold">새 이야기 남기기</h1>
        <p className="text-sm text-text-secondary">
          글의 목적에 맞는 공간을 고르면 동문들이 필요한 내용을 더 쉽게 찾을 수 있습니다.
        </p>
        <Link href="/board" className="text-xs text-text-muted underline">
          ← 목록으로 돌아가기
        </Link>
      </div>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (isDisabled) return;
          mutate.mutate();
        }}
      >
        <label className="block text-sm text-text-secondary">
          제목
          <input
            className="mt-1 min-h-11 w-full rounded border border-neutral-border px-3 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            placeholder={categoryInfo.titlePlaceholder}
            autoComplete="off"
            inputMode="text"
            aria-describedby="title-help"
          />
          <span id="title-help" className="sr-only">게시글 제목</span>
        </label>
        <label className="block text-sm text-text-secondary">
          글 종류
          <select
            className="mt-1 min-h-11 w-full rounded border border-neutral-border px-3 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
            value={category}
            onChange={(e) => setCategory(e.currentTarget.value as (typeof BOARD_CATEGORY_OPTIONS)[number]['value'])}
            aria-label="글 종류"
          >
            {BOARD_CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="mt-2 block text-xs leading-5 text-text-muted">{categoryInfo.description}</span>
        </label>
        <div className="space-y-1">
          <span className="block text-sm text-text-secondary">커버 이미지 (선택)</span>
          <ImageUpload
            value={coverImage}
            onUpload={setCoverImage}
            onRemove={() => setCoverImage(null)}
            disabled={isSubmitting}
          />
        </div>
        <label className="block text-sm text-text-secondary">
          내용
          <textarea
            className="mt-1 w-full rounded border border-neutral-border px-3 py-3 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
            rows={8}
            value={content}
            onChange={(e) => setContent(e.currentTarget.value)}
            placeholder={categoryInfo.contentPlaceholder}
            inputMode="text"
            autoComplete="off"
            aria-describedby="content-help"
          />
          <span id="content-help" className="sr-only">게시글 본문</span>
        </label>
        <button
          type="submit"
          className="min-h-11 rounded bg-brand-700 px-5 text-sm font-medium text-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-40"
          disabled={isDisabled}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? '등록하는 중…' : '게시글 등록하기'}
        </button>
        {error ? <p role="alert" aria-live="polite" className="text-sm text-state-error">{error}</p> : null}
      </form>
    </section>
  );
}
