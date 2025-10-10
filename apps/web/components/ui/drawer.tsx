import React, { useEffect, useId, useRef } from 'react';
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
      const list = Array.from(
        container.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')
      );
      if (list.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!active || !container.contains(active)) {
        e.preventDefault();
        first.focus();
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
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
      {/* Backdrop (비포커스) */}
      <div aria-hidden="true" className="absolute inset-0 bg-black/30" onClick={onClose} />
      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : title}
        tabIndex={-1}
        className={cn(
          'absolute top-0 h-full w-80 max-w-[80vw] bg-white shadow-xl outline-none z-10',
          side === 'left' ? 'left-0' : 'right-0',
          className
        )}
      >
        {(title || true) && (
          <div className="flex items-center justify-between border-b border-slate-200 p-3">
            {title ? (
              <h2 id={labelledBy} className="text-sm font-medium text-slate-800">
                {title}
              </h2>
            ) : (
              <span className="sr-only" id={labelledBy}>메뉴</span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded p-2 text-slate-600 hover:bg-slate-100"
              aria-label="닫기"
            >
              닫기
            </button>
          </div>
        )}
        <div className="p-3">{children}</div>
      </div>
    </div>
  );
}
