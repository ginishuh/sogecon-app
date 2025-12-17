"use client";

// 아주 단순한 토스트 구현(전역 큐 + 자동 소거)

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

type Toast = { id: number; message: string; type?: 'success' | 'error' | 'info' };

type ToastContextValue = {
  show: (message: string, opts?: { type?: Toast['type']; durationMs?: number }) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('ToastProvider가 필요합니다.');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((message: string, opts?: { type?: Toast['type']; durationMs?: number }) => {
    const id = Date.now() + Math.random();
    const toast: Toast = { id, message, type: opts?.type ?? 'info' };
    setToasts((q) => [...q, toast]);
    const ms = opts?.durationMs ?? 2500;
    window.setTimeout(() => {
      setToasts((q) => q.filter((t) => t.id !== id));
    }, ms);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={
              'pointer-events-auto rounded px-3 py-2 text-sm shadow ' +
              (t.type === 'success'
                ? 'bg-state-success text-text-inverse'
                : t.type === 'error'
                ? 'bg-state-error text-text-inverse'
                : 'bg-text-primary text-text-inverse')
            }
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

