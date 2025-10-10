import React, { useEffect, useRef } from 'react';

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

  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement;
      const el = panelRef.current;
      // body 스크롤 잠금
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      // 포커스 이동
      setTimeout(() => {
        el?.focus();
      }, 0);
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
    return undefined;
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Tab') {
        // 초간단 포커스 트랩
        const container = panelRef.current;
        if (!container) return;
        const focusables = container.querySelectorAll<HTMLElement>(
          'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
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
      {/* Backdrop */}
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0 cursor-default bg-black/30"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={[
          'absolute top-0 h-full w-80 max-w-[80vw] bg-white shadow-xl outline-none',
          side === 'left' ? 'left-0' : 'right-0',
          className ?? '',
        ].join(' ')}
      >
        {children}
      </div>
    </div>
  );
}

