import React from 'react';
import type { Member } from '../services/members';
import { hasPublicDirectoryDetails, VISIBILITY_INFO } from '../lib/member-experience';

type Props = {
  member: Member;
  onClick?: () => void;
};

export default function DirectoryCard({ member, onClick }: Props) {
  const hasDetails = hasPublicDirectoryDetails(member);
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
            {member.email || '이메일 비공개'}
          </p>
          <p className="mt-1 text-sm text-neutral-ink">
            {member.company || '소속 정보 비공개'}
          </p>
        </div>
        <span className="text-xs text-neutral-muted">
          {member.major || ''}
        </span>
      </header>
      <p className="mt-3 text-xs text-neutral-muted">{hasDetails ? VISIBILITY_INFO[member.visibility].label : '공개된 상세 정보가 아직 없어요.'}</p>
    </article>
  );
}
