import React from 'react';
import type { Member } from '../services/members';

type Props = {
  member: Member;
  onClick?: () => void;
};

export default function DirectoryCard({ member, onClick }: Props) {
  return (
    <article
      className="rounded-2xl border border-neutral-border bg-white p-4 shadow-sm cursor-pointer hover:border-neutral-ink/20 transition-colors"
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? 'button' : undefined}
      aria-label={onClick ? `${member.name} 상세 정보 보기` : undefined}
    >
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
        <span className="text-xs text-neutral-muted">
          {member.major ?? ''}
        </span>
      </header>
    </article>
  );
}
