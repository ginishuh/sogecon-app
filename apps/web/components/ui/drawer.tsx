import React, { useEffect, useId, useRef } from 'react';
import Image from 'next/image';
import { cn } from '../../lib/cn';

type DrawerProps = React.PropsWithChildren<{
  open: boolean;
  title?: string;
  side?: 'left' | 'right';
  onClose: () => void;
  className?: string;
}>;

// 접근성 고려사항:
// - role="dialog" aria-modal="true"
// - ESC로 닫기, Backdrop 클릭 닫기
// - 간단 포커스 트랩: 열릴 때 첫 포커서블로 이동, 닫을 때 이전 포커스 복구
export default function Drawer({ open, onClose, title, side = 'left', className, children }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<Element | null>(null);
  const titleUid = useId();
  const labelledBy = title ? `drawer-title-${titleUid}` : undefined;

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement;
    const el = panelRef.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // 첫 포커서블로 이동(없으면 패널)
    setTimeout(() => {
      const focusables = el?.querySelectorAll<HTMLElement>(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusables && focusables.length > 0 ? focusables[0] : el;
      first?.focus();
    }, 0);
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    function trapTab(container: HTMLElement, e: KeyboardEvent) {
      const list = Array.from(
        container.querySelectorAll<HTMLElement>(
          'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      );
      if (list.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }
      const active = document.activeElement as HTMLElement | null;
      // 범위 내 첫/마지막 포커서블 산출 후 분기
      const first = list[0] as HTMLElement;
      const last = list[list.length - 1] as HTMLElement;
      if (!active || !container.contains(active)) {
        e.preventDefault();
        first.focus();
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
        return;
      }
      if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const container = panelRef.current;
      if (!container) return;
      trapTab(container, e);
    }

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      const el = previouslyFocused.current as HTMLElement | null;
      el?.focus({ preventScroll: true });
    }
  }, [open]);

  if (!open) return null;

  return (
    <div aria-hidden={!open} className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div aria-hidden="true" className="absolute inset-0 bg-black/50" onClick={onClose} />
      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : '메뉴'}
        tabIndex={-1}
        className={cn(
          'absolute top-0 h-full bg-white shadow-xl outline-none z-10 flex flex-col',
          side === 'left' ? 'left-0' : 'right-0',
          className
        )}
      >
        {/* 헤더 */}
        <div className="flex items-center gap-2 p-4 shrink-0">
          {/* 서강대 로고 */}
          <div className="flex items-center gap-2">
            <Image
              src="/images/brand/sogang.svg"
              alt=""
              width={28}
              height={40}
              className="h-10 w-auto shrink-0"
            />
            <div className="text-sm font-semibold text-neutral-ink leading-tight">
              <div>서강대학교</div>
              <div>경제대학원 총동문회</div>
            </div>
          </div>
          {/* 닫기 버튼 */}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded opacity-70 hover:opacity-100 text-neutral-ink size-4 flex items-center justify-center"
            aria-label="닫기"
          >
            <svg className="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 4L4 12M4 4l8 8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {/* 컨텐츠 */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">{children}</div>
      </div>
    </div>
  );
}
