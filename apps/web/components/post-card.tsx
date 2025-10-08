import React from 'react';

export type PostCardProps = {
  title: string;
  content: string;
  category?: string | null;
  pinned?: boolean;
  cover_image?: string | null;
  published_at?: string | null;
};

export function PostCard({ title, content, category, pinned, cover_image, published_at }: PostCardProps) {
  return (
    <article className="flex gap-3 rounded border border-slate-200 bg-white p-4 shadow-sm">
      {cover_image ? (
        <img src={cover_image} alt="cover" className="h-16 w-16 rounded object-cover" />
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          {category ? (
            <span aria-label="category" className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{category}</span>
          ) : null}
          {pinned ? (
            <span aria-label="pinned" className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">PIN</span>
          ) : null}
        </div>
        <h3 className="truncate font-semibold" title={title}>{title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-slate-700">{content}</p>
        <p className="mt-2 text-xs text-slate-500">{published_at ? new Date(published_at).toLocaleString() : '미정'}</p>
      </div>
    </article>
  );
}

