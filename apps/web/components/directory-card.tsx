import React from 'react';
import { ArrowRight, LockSimple, UsersThree } from '@phosphor-icons/react';
import type { Member } from '../services/members';
import { hasPublicDirectoryDetails, VISIBILITY_INFO } from '../lib/member-experience';

type Props = {
  member: Member;
  onClick?: () => void;
};

export default function DirectoryCard({ member, onClick }: Props) {
  const hasDetails = hasPublicDirectoryDetails(member);
  const workSummary = [member.company, member.job_title].filter(Boolean).join(' · ');
  return (
    <article
      className="cursor-pointer rounded-2xl border border-neutral-border bg-white p-4 transition-colors hover:border-brand-200 hover:bg-brand-50/30 focus-visible:ring-2 focus-visible:ring-brand-500 sm:p-5"
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
      <header className="flex items-start gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-neutral-subtle text-xl font-medium text-text-muted" aria-hidden="true">
          {member.name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h3 className="text-lg font-semibold text-text-primary">{member.name}</h3>
            <span className="text-sm font-semibold text-brand-700">{member.cohort}기</span>
          </div>
          {member.email ? <p className="mt-1 truncate text-sm text-text-muted">{member.email}</p> : null}
        </div>
      </header>
      <div className="mt-4 space-y-2 border-t border-neutral-border pt-4 text-sm text-text-muted">
        <p className="flex items-center gap-2">
          <LockSimple aria-hidden="true" size={17} />
          {workSummary || (hasDetails ? '소속 정보 비공개' : '공개된 소속 정보가 아직 없어요.')}
        </p>
        <p className="flex items-center gap-2">
          <UsersThree aria-hidden="true" size={17} />
          {VISIBILITY_INFO[member.visibility].label}
        </p>
      </div>
      <div className="mt-4 flex min-h-11 items-center justify-between border-t border-neutral-border pt-3 text-sm font-semibold text-brand-700">
        <span>프로필 보기</span>
        <ArrowRight aria-hidden="true" size={18} />
      </div>
    </article>
  );
}
