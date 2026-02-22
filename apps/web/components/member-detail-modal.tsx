"use client";

/**
 * 회원 상세 정보 모달
 * - 동문 수첩에서 회원 클릭 시 표시
 * - 접근성: ESC 닫기, 포커스 트랩, aria 속성
 */

import React, { useCallback, useEffect, useId, useRef } from 'react';

import { formatPhone } from '../lib/phone-utils';
import type { Member } from '../services/members';

type MemberDetailModalProps = {
  member: Member | null;
  open: boolean;
  onClose: () => void;
};

/** 정보 항목 렌더링 헬퍼 */
function InfoItem({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-neutral-muted">{label}</dt>
      <dd className="text-sm text-neutral-ink">{value}</dd>
    </div>
  );
}

/** 섹션 헤더 */
function SectionHeader({ children }: { children: React.ReactNode }) {
  return <h4 className="text-xs font-semibold text-neutral-muted uppercase tracking-wide mb-2">{children}</h4>;
}

/** 모달 내용 - 기본 정보 */
function BasicInfoSection({ member, visibilityLabel }: { member: Member; visibilityLabel: string }) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <div className="size-16 rounded-full bg-neutral-subtle flex items-center justify-center overflow-hidden shrink-0">
          {member.avatar_url ? (
            <div
              className="size-full bg-cover bg-center"
              style={{ backgroundImage: `url(${member.avatar_url})` }}
              role="img"
              aria-label={`${member.name} 프로필 사진`}
            />
          ) : (
            <span className="text-2xl text-neutral-muted">{member.name.charAt(0)}</span>
          )}
        </div>
        <div>
          <p className="text-xl font-semibold text-neutral-ink">{member.name}</p>
          <p className="text-sm text-neutral-muted">{member.cohort}기 · {member.major ?? '전공 미입력'}</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3">
        <InfoItem label="이메일" value={member.email} />
        <InfoItem label="공개 범위" value={visibilityLabel} />
      </dl>
    </section>
  );
}

/** 모달 내용 - 연락처 */
function ContactSection({ member }: { member: Member }) {
  if (!member.phone && !member.addr_personal) return null;
  return (
    <section>
      <SectionHeader>연락처</SectionHeader>
      <dl className="grid grid-cols-2 gap-3">
        <InfoItem label="전화번호" value={formatPhone(member.phone)} />
        <InfoItem label="주소" value={member.addr_personal} />
      </dl>
    </section>
  );
}

/** 모달 내용 - 직장 정보 */
function WorkSection({ member }: { member: Member }) {
  if (!member.company && !member.department && !member.job_title && !member.industry) return null;
  return (
    <section>
      <SectionHeader>직장</SectionHeader>
      <dl className="grid grid-cols-2 gap-3">
        <InfoItem label="회사" value={member.company} />
        <InfoItem label="부서" value={member.department} />
        <InfoItem label="직함" value={member.job_title} />
        <InfoItem label="업종" value={member.industry} />
        <InfoItem label="회사 전화" value={formatPhone(member.company_phone)} />
        <InfoItem label="회사 주소" value={member.addr_company} />
      </dl>
    </section>
  );
}

const VISIBILITY_LABELS: Record<Member['visibility'], string> = {
  all: '전체 공개',
  cohort: '동기만',
  private: '비공개',
};

export default function MemberDetailModal({ member, open, onClose }: MemberDetailModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<Element | null>(null);
  const titleId = useId();

  // 스크롤 잠금 및 포커스 관리
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
      panelRef.current?.querySelector<HTMLButtonElement>('[data-close-btn]')?.focus();
    }, 0);

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // 이전 포커스 복구
  useEffect(() => {
    if (!open) {
      (previouslyFocused.current as HTMLElement | null)?.focus({ preventScroll: true });
    }
  }, [open]);

  // 키보드 핸들러 (ESC 닫기 + 포커스 트랩)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // 포커스 트랩: Tab/Shift+Tab 순환
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!first || !last) return;

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open || !member) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div aria-hidden="true" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative z-10 w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl"
      >
        <div className="sticky top-0 bg-white border-b border-neutral-border px-4 py-3 flex items-center justify-between">
          <h3 id={titleId} className="text-lg font-semibold text-neutral-ink">회원 정보</h3>
          <button
            type="button"
            data-close-btn
            onClick={onClose}
            className="rounded p-1 text-neutral-muted hover:text-neutral-ink hover:bg-neutral-subtle"
            aria-label="닫기"
          >
            <svg className="size-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 5L5 15M5 5l10 10" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="p-4 space-y-5">
          <BasicInfoSection member={member} visibilityLabel={VISIBILITY_LABELS[member.visibility]} />
          <ContactSection member={member} />
          <WorkSection member={member} />
        </div>
      </div>
    </div>
  );
}
