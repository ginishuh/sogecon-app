"use client";

/**
 * 이미지 업로드 컴포넌트
 * - 드래그 앤 드롭 지원
 * - 클릭하여 파일 선택
 * - 미리보기 표시
 * - 로딩/에러 상태 처리
 */

import React, { useCallback, useRef, useState } from 'react';

import { ApiError } from '../lib/api';
import { uploadImage } from '../services/uploads';

export type ImageUploadProps = {
  /** 업로드 완료 시 URL 전달 */
  onUpload: (url: string) => void;
  /** 현재 이미지 URL (미리보기용) */
  value?: string | null;
  /** 이미지 제거 */
  onRemove?: () => void;
  /** 비활성화 */
  disabled?: boolean;
  /** 추가 클래스 */
  className?: string;
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

/** 이미지 미리보기 컴포넌트 */
function ImagePreview({
  src,
  onRemove,
  disabled,
}: {
  src: string;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative rounded-lg overflow-hidden border border-slate-200">
      <div
        role="img"
        aria-label="업로드된 이미지 미리보기"
        className="w-full h-48 bg-cover bg-center"
        style={{ backgroundImage: `url(${src})` }}
      />
      {onRemove && !disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition-colors"
          aria-label="이미지 삭제"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
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
      )}
    </div>
  );
}

/** 드롭존 내부 콘텐츠 */
function DropzoneContent({ isUploading, isDragging }: { isUploading: boolean; isDragging: boolean }) {
  if (isUploading) {
    return (
      <div className="flex flex-col items-center gap-2 text-slate-500">
        <svg className="animate-spin h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span className="text-sm">업로드 중...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 text-slate-500">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
      <div className="text-center">
        <p className="text-sm font-medium">{isDragging ? '여기에 놓으세요' : '클릭 또는 드래그하여 이미지 업로드'}</p>
        <p className="text-xs text-slate-400 mt-1">JPEG, PNG, WebP (최대 {MAX_SIZE_MB}MB)</p>
      </div>
    </div>
  );
}

export function ImageUpload({ onUpload, value, onRemove, disabled = false, className = '' }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
        onUpload(result.url);
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
    [onUpload],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      if (disabled || isUploading) return;

      const file = e.dataTransfer.files[0];
      if (file) {
        void handleUpload(file);
      }
    },
    [disabled, isUploading, handleUpload],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        void handleUpload(file);
      }
      // 같은 파일 재선택 허용
      e.target.value = '';
    },
    [handleUpload],
  );

  const handleClick = useCallback(() => {
    if (disabled || isUploading) return;
    inputRef.current?.click();
  }, [disabled, isUploading]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick],
  );

  const isInteractive = !disabled && !isUploading;
  const baseClasses = 'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors';
  const stateClasses = isDragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 hover:border-slate-400 bg-slate-50';
  const disabledClasses = isInteractive ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed';

  // 이미지가 있으면 미리보기 표시
  if (value) {
    return (
      <div className={className}>
        <ImagePreview src={value} onRemove={onRemove} disabled={disabled} />
      </div>
    );
  }

  return (
    <div className={className}>
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
        className={`${baseClasses} ${stateClasses} ${disabledClasses} h-40 px-4`}
        aria-label="이미지 업로드 영역"
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
        <DropzoneContent isUploading={isUploading} isDragging={isDragging} />
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export default ImageUpload;
