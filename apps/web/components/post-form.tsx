"use client";

import { useState, useEffect } from 'react';
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
  /** 수정 모드일 때 기존 게시물 데이터 */
  initialData?: Post;
  /** 제출 버튼 텍스트 */
  submitLabel?: string;
  /** 로딩 중 버튼 텍스트 */
  loadingLabel?: string;
  /** 제출 처리 중 여부 */
  isPending?: boolean;
  /** 에러 메시지 */
  error?: string | null;
  /** 폼 제출 시 호출 */
  onSubmit: (data: PostFormData) => void;
  /** 취소 버튼 클릭 시 호출 */
  onCancel?: () => void;
};

export function PostForm({
  initialData,
  submitLabel = '저장',
  loadingLabel = '저장 중...',
  isPending = false,
  error = null,
  onSubmit,
  onCancel,
}: PostFormProps) {
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [content, setContent] = useState(initialData?.content ?? '');
  const [category, setCategory] = useState<'notice' | 'news' | 'hero'>(
    (initialData?.category as 'notice' | 'news' | 'hero') ?? 'notice'
  );
  const [pinned, setPinned] = useState(initialData?.pinned ?? false);
  const [coverImage, setCoverImage] = useState<string | null>(
    initialData?.cover_image ?? null
  );
  const [images, setImages] = useState<string[]>(initialData?.images ?? []);
  const [published, setPublished] = useState(
    initialData ? initialData.published_at !== null : true
  );

  // initialData 변경 시 폼 상태 업데이트 (수정 모드 데이터 로드)
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setContent(initialData.content);
      setCategory((initialData.category as 'notice' | 'news' | 'hero') ?? 'notice');
      setPinned(initialData.pinned ?? false);
      setCoverImage(initialData.cover_image ?? null);
      setImages(initialData.images ?? []);
      setPublished(initialData.published_at !== null);
    }
  }, [initialData]);

  const handleSubmit = () => {
    onSubmit({
      title,
      content,
      category,
      pinned,
      cover_image: coverImage,
      images,
      published,
    });
  };

  return (
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
          disabled={isPending}
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

      {/* 공개 상태 */}
      <div className="space-y-2">
        <span className="block text-sm font-medium text-slate-700">공개 상태</span>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="published"
              checked={published}
              onChange={() => setPublished(true)}
              className="border-slate-300"
            />
            즉시 공개
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="published"
              checked={!published}
              onChange={() => setPublished(false)}
              className="border-slate-300"
            />
            비공개 (초안)
          </label>
        </div>
      </div>

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

      {/* 버튼 */}
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
          disabled={isPending || !title || !content}
          onClick={handleSubmit}
        >
          {isPending ? loadingLabel : submitLabel}
        </button>
      </div>
    </div>
  );
}
