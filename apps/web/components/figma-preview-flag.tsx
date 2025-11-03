"use client";

import { useEffect } from 'react';

export default function FigmaPreviewFlag({ active }: { active?: boolean }) {
  useEffect(() => {
    if (!active) return;
    document.body.classList.add('is-figma-preview');
    return () => { document.body.classList.remove('is-figma-preview'); };
  }, [active]);
  return null;
}

