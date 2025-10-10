import React, { useCallback, useId, useMemo, useRef, useState } from 'react';

export interface TabItem {
  id: string;
  label: string;
  content: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  items: TabItem[];
  defaultIndex?: number;
  onChange?: (index: number) => void;
}

/** 접근성 탭 — 키보드 좌/우/홈/엔드, aria-selected/controls 연결 */
export function Tabs({ items, defaultIndex = 0, onChange, className, ...rest }: TabsProps) {
  const [index, setIndex] = useState(() => {
    const firstEnabled = items.findIndex((t) => !t.disabled);
    const isValidDefault =
      defaultIndex >= 0 &&
      defaultIndex < items.length &&
      !items[defaultIndex]?.disabled;
    if (isValidDefault) return defaultIndex;
    return firstEnabled >= 0 ? firstEnabled : 0;
  });
  const uid = useId();
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);

  const selectIndex = useCallback(
    (target: number) => {
      const idx = Math.max(0, Math.min(items.length - 1, target));
      setIndex(idx);
      onChange?.(idx);
      tabsRef.current[idx]?.focus();
    },
    [items.length, onChange],
  );

  const move = useCallback(
    (delta: number) => {
      if (items.length === 0) return;
      let next = index;
      for (let i = 0; i < items.length; i += 1) {
        next = (next + delta + items.length) % items.length;
        if (!items[next]?.disabled) break;
      }
      selectIndex(next);
    },
    [index, items, selectIndex],
  );

  const firstEnabled = useCallback(() => items.findIndex((t) => !t.disabled), [items]);
  const lastEnabled = useCallback(() => {
    for (let i = items.length - 1; i >= 0; i -= 1) {
      if (!items[i]?.disabled) return i;
    }
    return Math.max(0, items.length - 1);
  }, [items]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const handlers: Record<string, () => void> = {
      ArrowRight: () => move(1),
      ArrowLeft: () => move(-1),
      Home: () => selectIndex(Math.max(0, firstEnabled() ?? 0)),
      End: () => selectIndex(lastEnabled()),
    };
    const fn = handlers[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  }, [firstEnabled, lastEnabled, move, selectIndex]);

  const ids = useMemo(
    () =>
      items.map((t) => ({
        tabId: `tab-${uid}-${t.id}`,
        panelId: `tabpanel-${uid}-${t.id}`,
      })),
    [items, uid],
  );

  return (
    <div className={className} {...rest}>
      <div role="tablist" aria-label={rest['aria-label']} className="flex gap-2 border-b border-neutral-border" onKeyDown={onKeyDown}>
        {items.map((t, i) => {
          const selected = i === index;
          const { tabId, panelId } = ids[i]!;
          return (
            <button
              key={t.id}
              id={tabId}
              role="tab"
              ref={(el) => {
                tabsRef.current[i] = el;
              }}
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              disabled={t.disabled}
              className={[
                'rounded-t-md px-3 py-2 text-sm font-medium min-h-11', // 터치 타겟 44px 이상
                selected
                  ? 'bg-surface text-text-primary border-x border-t border-neutral-border -mb-px'
                  : 'text-text-muted hover:text-text-primary',
              ].join(' ')}
              onClick={() => {
                if (t.disabled) return;
                setIndex(i);
                onChange?.(i);
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {items.map((t, i) => {
        const selected = i === index;
        const { tabId, panelId } = ids[i]!;
        return (
          <div
            key={t.id}
            id={panelId}
            role="tabpanel"
            aria-labelledby={tabId}
            hidden={!selected}
            className="rounded-b-md border border-neutral-border p-4"
          >
            {selected ? t.content : null}
          </div>
        );
      })}
    </div>
  );
}

export default Tabs;
