"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';

type Item = { href: Route; label: string };

type Props = {
  label: string;
  items: Item[];
};

export function NavDropdown({ label, items }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!ref.current) return;
      if (open && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
        className="rounded px-2 py-1 text-sm text-neutral-muted hover:text-brand-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
      >
        {label}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-2 w-56 rounded-md border border-neutral-border bg-white p-2 shadow-lg"
        >
          <ul className="grid gap-1">
            {items.map((it) => (
              <li key={it.href}>
                <Link
                  href={it.href}
                  className="block rounded px-3 py-2 text-sm text-neutral-ink hover:bg-brand-surface hover:text-brand-primary"
                  onClick={() => setOpen(false)}
                  role="menuitem"
                >
                  {it.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

