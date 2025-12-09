"use client";

import { useState, useEffect, useCallback } from 'react';
import { MultiImageUpload } from './multi-image-upload';
import type { Post } from '../services/posts';

export type PostFormData = {
  title: string;
  content: string;
  category: 'notice' | 'news' | 'hero';
  pinned: boolean;
  cover_image: string | null;
  images: string[];
  published: boolean;
};

type PostFormProps = {
  initialData?: Post;
  submitLabel?: string;
  loadingLabel?: string;
  isPending?: boolean;
  error?: string | null;
  onSubmit: (data: PostFormData) => void;
  onCancel?: () => void;
};

type CategoryType = 'notice' | 'news' | 'hero';

/** 폼 상태 관리 훅 */
function usePostFormState(initialData?: Post) {
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [content, setContent] = useState(initialData?.content ?? '');
  const [category, setCategory] = useState<CategoryType>(
    (initialData?.category as CategoryType) ?? 'notice'
  );
  const [pinned, setPinned] = useState(initialData?.pinned ?? false);
  const [coverImage, setCoverImage] = useState<string | null>(
    initialData?.cover_image ?? null
  );
  const [images, setImages] = useState<string[]>(initialData?.images ?? []);
  const [published, setPublished] = useState(
    initialData ? initialData.published_at !== null : true
  );

  useEffect(() => {
    if (!initialData) return;
    setTitle(initialData.title);
    setContent(initialData.content);
    setCategory((initialData.category as CategoryType) ?? 'notice');
    setPinned(initialData.pinned ?? false);
    setCoverImage(initialData.cover_image ?? null);
    setImages(initialData.images ?? []);
    setPublished(initialData.published_at !== null);
  }, [initialData]);

  const getData = useCallback(
    (): PostFormData => ({
      title,
      content,
      category,
      pinned,
      cover_image: coverImage,
      images,
      published,
    }),
    [title, content, category, pinned, coverImage, images, published]
  );

  return {
    title, setTitle,
    content, setContent,
    category, setCategory,
    pinned, setPinned,
    coverImage, setCoverImage,
    images, setImages,
    published, setPublished,
    getData,
  };
}

export function PostForm({
  initialData,
  submitLabel = '저장',
  loadingLabel = '저장 중...',
  isPending = false,
  error = null,
  onSubmit,
  onCancel,
}: PostFormProps) {
  const state = usePostFormState(initialData);
  const handleSubmit = () => onSubmit(state.getData());
  const maxImages = state.category === 'hero' ? 5 : 10;

  return (
    <div className="space-y-4">
      <CategoryField value={state.category} onChange={state.setCategory} />
      <TitleField value={state.title} onChange={state.setTitle} />
      <ImageField
        category={state.category}
        coverImage={state.coverImage}
        images={state.images}
        onCoverChange={state.setCoverImage}
        onImagesChange={state.setImages}
        disabled={isPending}
        maxImages={maxImages}
      />
      <ContentField value={state.content} onChange={state.setContent} />
      <PublishField value={state.published} onChange={state.setPublished} />
      <PinnedField value={state.pinned} onChange={state.setPinned} />
      {error && <ErrorMessage message={error} />}
      <FormButtons
        onCancel={onCancel}
        onSubmit={handleSubmit}
        isPending={isPending}
        disabled={!state.title || !state.content}
        submitLabel={submitLabel}
        loadingLabel={loadingLabel}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Sub-components (complexity isolation)
───────────────────────────────────────────────────────────────────────── */

function CategoryField({
  value,
  onChange,
}: {
  value: CategoryType;
  onChange: (v: CategoryType) => void;
}) {
  return (
    <label className="block text-sm text-slate-700">
      카테고리
      <select
        className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.currentTarget.value as CategoryType)}
      >
        <option value="notice">공지</option>
        <option value="news">소식</option>
        <option value="hero">히어로 (홈 배너)</option>
      </select>
    </label>
  );
}

function TitleField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm text-slate-700">
      제목
      <input
        className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        placeholder="글 제목을 입력하세요"
      />
    </label>
  );
}

function ImageField({
  category,
  coverImage,
  images,
  onCoverChange,
  onImagesChange,
  disabled,
  maxImages,
}: {
  category: CategoryType;
  coverImage: string | null;
  images: string[];
  onCoverChange: (v: string | null) => void;
  onImagesChange: (v: string[]) => void;
  disabled: boolean;
  maxImages: number;
}) {
  return (
    <div className="space-y-1">
      <span className="block text-sm text-slate-700">
        이미지 {category === 'hero' ? '(필수)' : '(선택)'}
      </span>
      <MultiImageUpload
        coverImage={coverImage}
        images={images}
        onCoverChange={onCoverChange}
        onImagesChange={onImagesChange}
        disabled={disabled}
        maxImages={maxImages}
      />
    </div>
  );
}

function ContentField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm text-slate-700">
      내용
      <textarea
        className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
        rows={8}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        placeholder="내용을 입력하세요"
      />
    </label>
  );
}

function PublishField({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-slate-700">공개 상태</span>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="radio"
            name="published"
            checked={value}
            onChange={() => onChange(true)}
            className="border-slate-300"
          />
          즉시 공개
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="radio"
            name="published"
            checked={!value}
            onChange={() => onChange(false)}
            className="border-slate-300"
          />
          비공개 (초안)
        </label>
      </div>
    </div>
  );
}

function PinnedField({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.currentTarget.checked)}
        className="rounded border-slate-300"
      />
      상단 고정 (PIN)
    </label>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <p role="alert" className="text-sm text-red-600">
      {message}
    </p>
  );
}

function FormButtons({
  onCancel,
  onSubmit,
  isPending,
  disabled,
  submitLabel,
  loadingLabel,
}: {
  onCancel?: () => void;
  onSubmit: () => void;
  isPending: boolean;
  disabled: boolean;
  submitLabel: string;
  loadingLabel: string;
}) {
  return (
    <div className="flex gap-2">
      {onCancel && (
        <button
          type="button"
          className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          onClick={onCancel}
        >
          취소
        </button>
      )}
      <button
        type="button"
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        disabled={isPending || disabled}
        onClick={onSubmit}
      >
        {isPending ? loadingLabel : submitLabel}
      </button>
    </div>
  );
}
