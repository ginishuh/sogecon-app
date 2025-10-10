import React, { useState } from 'react';
import type { Member } from '../services/members';

type Props = {
  member: Member;
};

export default function DirectoryCard({ member }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = `dir-card-${member.id}`;
  return (
    <article className="rounded-2xl border border-neutral-border bg-white p-4 shadow-sm">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-neutral-ink">
            {member.name}
            <span className="ml-2 align-middle text-xs font-medium text-neutral-muted">{member.cohort}기</span>
          </h3>
          <p className="truncate text-xs text-neutral-muted">
            {member.email}
          </p>
          <p className="mt-1 text-sm text-neutral-ink">
            {member.company ?? '-'}
          </p>
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="rounded border border-neutral-border px-3 py-1.5 text-sm text-neutral-ink hover:bg-neutral-surface"
        >
          {open ? '접기' : '자세히'}
        </button>
      </header>
      <section id={panelId} role="region" aria-label="상세 정보" hidden={!open} className="mt-3 text-sm text-neutral-ink">
        <dl className="grid grid-cols-2 gap-2">
          <div>
            <dt className="text-xs text-neutral-muted">전공</dt>
            <dd>{member.major ?? '-'}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-muted">업종</dt>
            <dd>{member.industry ?? '-'}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-muted">공개 범위</dt>
            <dd className="text-xs uppercase text-neutral-muted">{member.visibility}</dd>
          </div>
        </dl>
      </section>
    </article>
  );
}

