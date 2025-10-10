import React, { useId, useState } from 'react';
import { cn } from '../../lib/cn';

type Props = React.PropsWithChildren<{
  summary: string;
  defaultOpen?: boolean;
  density?: 'sm' | 'md';
  className?: string;
}>;

export default function Accordion({ summary, defaultOpen, density = 'md', className, children }: Props) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const uid = useId();
  const panelId = `accordion-panel-${uid}`;
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full rounded-md border border-neutral-border bg-white text-left font-medium text-neutral-ink',
          density === 'sm' ? 'px-3 py-2 text-sm' : 'px-4 py-3'
        )}
      >
        {summary}
      </button>
      <div
        id={panelId}
        role="region"
        aria-label={`${summary} 내용`}
        hidden={!open}
        className={cn(density === 'sm' ? 'px-2 py-2' : 'px-3 py-3')}
      >
        {children}
      </div>
    </div>
  );
}
