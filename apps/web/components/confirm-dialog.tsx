"use client";

import type { MouseEvent } from 'react';
import { useEffect, useId, useRef } from 'react';

type ConfirmDialogProps = {
  /** 다이얼로그 표시 여부 */
  open: boolean;
  /** 다이얼로그 제목 */
  title: string;
  /** 다이얼로그 설명 */
  description?: string;
  /** 확인 버튼 텍스트 */
  confirmLabel?: string;
  /** 취소 버튼 텍스트 */
  cancelLabel?: string;
  /** 확인 버튼 스타일 (danger: 빨간색) */
  variant?: 'default' | 'danger';
  /** 로딩 상태 */
  isPending?: boolean;
  /** 확인 클릭 시 호출 */
  onConfirm: () => void;
  /** 취소/닫기 클릭 시 호출 */
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '확인',
  cancelLabel = '취소',
  variant = 'default',
  isPending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) {
        openerRef.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        dialog.showModal();
        cancelButtonRef.current?.focus();
      }
    } else if (dialog.open) {
      dialog.close();
      openerRef.current?.focus();
      openerRef.current = null;
    }
  }, [open]);

  // ESC 키로 닫기
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onCancel();
    };

    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onCancel]);

  // backdrop 클릭으로 닫기
  const handleBackdropClick = (e: MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const rect = dialog.getBoundingClientRect();
    const isClickOutside =
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom;
    if (isClickOutside) {
      onCancel();
    }
  };

  const confirmButtonClass =
    variant === 'danger'
      ? 'bg-state-error text-white hover:bg-state-error-hover'
      : 'bg-brand-700 text-white hover:bg-brand-800';

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className="rounded-lg p-0 backdrop:bg-black/50"
      onClick={handleBackdropClick}
    >
      <div className="w-80 p-6 sm:w-96">
        <h3 id={titleId} className="text-lg font-semibold text-text-primary">{title}</h3>
        {description && (
          <p id={descriptionId} className="mt-2 whitespace-pre-line text-sm text-text-secondary">{description}</p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={cancelButtonRef}
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded border border-neutral-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-raised focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 disabled:opacity-50"
            onClick={onCancel}
            disabled={isPending}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded px-4 py-2 text-sm font-medium focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 disabled:opacity-50 ${confirmButtonClass}`}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? '처리 중...' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
