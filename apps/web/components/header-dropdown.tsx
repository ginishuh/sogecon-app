"use client";

import type { Route } from 'next';
import Link from 'next/link';
import React, { useState } from 'react';

interface DropdownItem {
  href: Route;
  label: string;
}

interface HeaderDropdownProps {
  label: string;
  items: readonly DropdownItem[];
  variant?: 'default' | 'admin';
  align?: 'left' | 'right';
}

/**
 * 헤더 드롭다운 메뉴 컴포넌트
 * SiteHeader 복잡도 감소를 위해 분리
 */
export function HeaderDropdown({ label, items, variant = 'default', align = 'left' }: HeaderDropdownProps) {
  const [open, setOpen] = useState(false);

  const buttonClass = variant === 'admin'
    ? 'flex items-center gap-1 px-2 py-2 font-kopub text-base text-brand-700 hover:text-brand-800 transition-colors'
    : 'flex items-center gap-1 px-2 py-2 font-kopub text-base text-neutral-ink hover:text-brand-700 transition-colors';

  const alignClass = align === 'right' ? 'right-0' : 'left-0';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={buttonClass}
      >
        {label}
        <svg
          className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className={`absolute top-full ${alignClass} mt-1 w-36 bg-white border border-neutral-border rounded-lg shadow-lg py-1 z-50`}>
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-4 py-2 font-kopub text-sm text-neutral-ink no-underline hover:no-underline hover:bg-neutral-subtle hover:text-brand-700"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
