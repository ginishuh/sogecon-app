"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { MultiImageUpload } from './multi-image-upload';
import type { Post } from '../services/posts';

export type PostFormData = {
  title: string;
  content: string;
  category: 'notice' | 'news';
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
  /** 관리자 전용 옵션 숨김 (카테고리, 공개 상태, 상단 고정) - 일반 사용자 수정 시 */
  hideAdminOptions?: boolean;
  /** 레거시/특수 카테고리 등으로 카테고리 변경을 막고 싶을 때 */
  hideCategory?: boolean;
};

type CategoryType = 'notice' | 'news';

const DEFAULT_VALUES = {
  title: '',
  content: '',
  category: 'notice' as CategoryType,
  pinned: false,
  coverImage: null as string | null,
  images: [] as string[],
  published: true,
};

/** 초기 데이터에서 폼 기본값 추출 */
function getInitialValues(initialData?: Post) {
  if (!initialData) return DEFAULT_VALUES;
  const category: CategoryType = initialData.category === 'news' ? 'news' : 'notice';
  return {
    title: initialData.title,
    content: initialData.content,
    category,
    pinned: initialData.pinned || false,
    coverImage: initialData.cover_image ?? null,
    images: initialData.images || [],
    published: initialData.published_at !== null,
  };
}

/** initialData 변경 시 상태 동기화 */
function useSyncInitialData(
  initialData: Post | undefined,
  setters: {
    setTitle: (v: string) => void;
    setContent: (v: string) => void;
    setCategory: (v: CategoryType) => void;
    setPinned: (v: boolean) => void;
    setCoverImage: (v: string | null) => void;
    setImages: (v: string[]) => void;
    setPublished: (v: boolean) => void;
  }
) {
  useEffect(() => {
    if (!initialData) return;
    const vals = getInitialValues(initialData);
    setters.setTitle(vals.title);
    setters.setContent(vals.content);
    setters.setCategory(vals.category);
    setters.setPinned(vals.pinned);
    setters.setCoverImage(vals.coverImage);
    setters.setImages(vals.images);
    setters.setPublished(vals.published);
  }, [initialData, setters]);
}

/** 폼 상태 관리 훅 */
function usePostFormState(initialData?: Post) {
  const init = getInitialValues(initialData);
  const [title, setTitle] = useState(init.title);
  const [content, setContent] = useState(init.content);
  const [category, setCategory] = useState<CategoryType>(init.category);
  const [pinned, setPinned] = useState(init.pinned);
  const [coverImage, setCoverImage] = useState<string | null>(init.coverImage);
  const [images, setImages] = useState<string[]>(init.images);
  const [published, setPublished] = useState(init.published);

  const setters = useMemo(
    () => ({
      setTitle,
      setContent,
      setCategory,
      setPinned,
      setCoverImage,
      setImages,
      setPublished,
    }),
    []
  );

  useSyncInitialData(initialData, setters);

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
    title,
    setTitle,
    content,
    setContent,
    category,
    setCategory,
    pinned,
    setPinned,
    coverImage,
    setCoverImage,
    images,
    setImages,
    published,
    setPublished,
    getData,
  };
}

/** 게시글 최대 이미지 수 */
function getMaxImages(): number {
  return 10;
}

/** 관리자 전용 상단 필드 (카테고리) */
function AdminTopFields({
  category,
  setCategory,
}: {
  category: CategoryType;
  setCategory: (v: CategoryType) => void;
}) {
  return <CategoryField value={category} onChange={setCategory} />;
}

/** 관리자 전용 하단 필드 (공개상태 + 핀) */
function AdminBottomFields({
  published,
  setPublished,
  pinned,
  setPinned,
}: {
  published: boolean;
  setPublished: (v: boolean) => void;
  pinned: boolean;
  setPinned: (v: boolean) => void;
}) {
  return (
    <>
      <PublishField value={published} onChange={setPublished} />
      <PinnedField value={pinned} onChange={setPinned} />
    </>
  );
}

function PostFormAdminFields({
  hideAdminOptions,
  hideCategory,
  category,
  setCategory,
  published,
  setPublished,
  pinned,
  setPinned,
}: {
  hideAdminOptions: boolean;
  hideCategory: boolean;
  category: CategoryType;
  setCategory: (v: CategoryType) => void;
  published: boolean;
  setPublished: (v: boolean) => void;
  pinned: boolean;
  setPinned: (v: boolean) => void;
}) {
  if (hideAdminOptions) return null;

  return (
    <>
      <div hidden={hideCategory}>
        <AdminTopFields category={category} setCategory={setCategory} />
      </div>
      <AdminBottomFields
        published={published}
        setPublished={setPublished}
        pinned={pinned}
        setPinned={setPinned}
      />
    </>
  );
}

function PostFormError({ error }: { error: string | null }) {
  if (!error) return null;
  return <ErrorMessage message={error} />;
}

function isSubmitDisabled(title: string, content: string): boolean {
  return !title || !content;
}

export function PostForm({
  initialData,
  submitLabel = '저장',
  loadingLabel = '저장 중...',
  isPending = false,
  error = null,
  onSubmit,
  onCancel,
  hideAdminOptions = false,
  hideCategory = false,
}: PostFormProps) {
  const state = usePostFormState(initialData);
  const handleSubmit = () => onSubmit(state.getData());

  return (
    <div className="space-y-4">
      <PostFormAdminFields
        hideAdminOptions={hideAdminOptions}
        hideCategory={hideCategory}
        category={state.category}
        setCategory={state.setCategory}
        published={state.published}
        setPublished={state.setPublished}
        pinned={state.pinned}
        setPinned={state.setPinned}
      />
      <TitleField value={state.title} onChange={state.setTitle} />
      <ImageField
        coverImage={state.coverImage}
        images={state.images}
        onCoverChange={state.setCoverImage}
        onImagesChange={state.setImages}
        disabled={isPending}
        maxImages={getMaxImages()}
      />
      <ContentField value={state.content} onChange={state.setContent} />
      <PostFormError error={error} />
      <FormButtons
        onCancel={onCancel}
        onSubmit={handleSubmit}
        isPending={isPending}
        disabled={isSubmitDisabled(state.title, state.content)}
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
  coverImage,
  images,
  onCoverChange,
  onImagesChange,
  disabled,
  maxImages,
}: {
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
        이미지 (선택)
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
