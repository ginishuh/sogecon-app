"use client";

/**
 * 다중 이미지 업로드 컴포넌트
 * - 여러 장 업로드 지원
 * - 드래그 앤 드롭 지원
 * - 메인(커버) 이미지 선택 기능
 * - 이미지 순서 변경 (드래그) - 향후 구현
 */

import React, { useCallback, useRef, useState } from 'react';

import { ApiError } from '../lib/api';
import { uploadImage } from '../services/uploads';

export type MultiImageUploadProps = {
  /** 메인(커버) 이미지 URL */
  coverImage: string | null;
  /** 추가 이미지 URL 배열 */
  images: string[];
  /** 메인 이미지 변경 */
  onCoverChange: (url: string | null) => void;
  /** 이미지 배열 변경 */
  onImagesChange: (urls: string[]) => void;
  /** 비활성화 */
  disabled?: boolean;
  /** 최대 이미지 개수 */
  maxImages?: number;
};

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1_000_000;

function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return '지원하지 않는 형식입니다. (JPEG, PNG, WebP만 가능)';
  }
  if (file.size > MAX_SIZE_BYTES) {
    return `파일 크기가 ${MAX_SIZE_MB}MB를 초과했습니다.`;
  }
  return null;
}

/** 개별 이미지 썸네일 */
function ImageThumbnail({
  src,
  isMain,
  onSetMain,
  onRemove,
  disabled,
}: {
  src: string;
  isMain: boolean;
  onSetMain: () => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`relative group rounded-lg overflow-hidden border-2 transition-colors ${
        isMain ? 'border-brand-primary ring-2 ring-brand-primary/30' : 'border-neutral-border'
      }`}
    >
      <div
        role="img"
        aria-label={isMain ? '메인 이미지' : '추가 이미지'}
        className="w-full h-28 bg-cover bg-center"
        style={{ backgroundImage: `url(${src})` }}
      />
      {/* 메인 이미지 배지 */}
      {isMain && (
        <div className="absolute top-1 left-1 bg-brand-primary text-white text-xs px-1.5 py-0.5 rounded">
          메인
        </div>
      )}
      {/* 호버 시 액션 버튼들 */}
      {!disabled && (
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          {!isMain && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSetMain();
              }}
              className="rounded bg-white/90 px-2 py-1 text-xs font-medium text-text-secondary hover:bg-white transition-colors"
              title="메인으로 설정"
            >
              메인
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="rounded-full bg-state-error/90 p-1.5 text-white hover:bg-state-error-hover transition-colors"
            aria-label="이미지 삭제"
            title="삭제"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

/** 업로드 드롭존 */
function UploadDropzone({
  onUpload,
  isUploading,
  disabled,
  remainingSlots,
}: {
  onUpload: (file: File) => void;
  isUploading: boolean;
  disabled: boolean;
  remainingSlots: number;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled || isUploading || remainingSlots <= 0) return;

      const file = e.dataTransfer.files[0];
      if (file) {
        onUpload(file);
      }
    },
    [disabled, isUploading, remainingSlots, onUpload],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onUpload(file);
      }
      e.target.value = '';
    },
    [onUpload],
  );

  const handleClick = useCallback(() => {
    if (disabled || isUploading || remainingSlots <= 0) return;
    inputRef.current?.click();
  }, [disabled, isUploading, remainingSlots]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick],
  );

  const isInteractive = !disabled && !isUploading && remainingSlots > 0;

  return (
    <div
      role="button"
      tabIndex={isInteractive ? 0 : -1}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragging(false);
      }}
      className={`
        flex flex-col items-center justify-center rounded-lg border-2 border-dashed h-28 px-3
        transition-colors
        ${isDragging ? 'border-brand-primary bg-brand-primary/5' : 'border-neutral-border hover:border-brand-400 bg-surface-raised'}
        ${isInteractive ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}
      `}
      aria-label="이미지 추가"
      aria-disabled={!isInteractive}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleFileChange}
        className="sr-only"
        disabled={!isInteractive}
        aria-hidden="true"
      />
      {isUploading ? (
        <svg className="animate-spin h-6 w-6 text-text-muted" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        <>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-text-muted"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span className="text-xs text-text-muted mt-1">추가</span>
        </>
      )}
    </div>
  );
}

export function MultiImageUpload({
  coverImage,
  images,
  onCoverChange,
  onImagesChange,
  disabled = false,
  maxImages = 10,
}: MultiImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 모든 이미지 (커버 + 추가 이미지)
  const allImages = coverImage ? [coverImage, ...images.filter((img) => img !== coverImage)] : images;
  const remainingSlots = maxImages - allImages.length;

  const handleUpload = useCallback(
    async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setError(null);
      setIsUploading(true);

      try {
        const result = await uploadImage(file);
        const newUrl = result.url;

        // 첫 번째 이미지는 자동으로 커버로 설정
        if (!coverImage && images.length === 0) {
          onCoverChange(newUrl);
          onImagesChange([newUrl]);
        } else {
          onImagesChange([...images, newUrl]);
        }
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message || '업로드 중 오류가 발생했습니다.');
        } else {
          setError('알 수 없는 오류가 발생했습니다.');
        }
      } finally {
        setIsUploading(false);
      }
    },
    [coverImage, images, onCoverChange, onImagesChange],
  );

  const handleSetMain = useCallback(
    (url: string) => {
      onCoverChange(url);
    },
    [onCoverChange],
  );

  const handleRemove = useCallback(
    (url: string) => {
      const newImages = images.filter((img) => img !== url);
      onImagesChange(newImages);

      // 커버 이미지를 삭제한 경우
      if (coverImage === url) {
        // 남은 이미지 중 첫 번째를 커버로
        const nextCover = newImages[0] ?? null;
        onCoverChange(nextCover);
      }
    },
    [coverImage, images, onCoverChange, onImagesChange],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary">
          이미지 {allImages.length}/{maxImages}장
        </span>
        {allImages.length > 0 && (
          <span className="text-xs text-text-muted">
            클릭하여 메인 이미지 선택
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {allImages.map((url) => (
          <ImageThumbnail
            key={url}
            src={url}
            isMain={url === coverImage}
            onSetMain={() => handleSetMain(url)}
            onRemove={() => handleRemove(url)}
            disabled={disabled}
          />
        ))}
        {remainingSlots > 0 && (
          <UploadDropzone
            onUpload={handleUpload}
            isUploading={isUploading}
            disabled={disabled}
            remainingSlots={remainingSlots}
          />
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-state-error">
          {error}
        </p>
      )}

      <p className="text-xs text-text-muted">
        JPEG, PNG, WebP (최대 {MAX_SIZE_MB}MB/장)
      </p>
    </div>
  );
}

export default MultiImageUpload;
