import Link from 'next/link';
import React from 'react';
import { siteConfig } from '../lib/site';

const SUPPORT_LINKS = [
  { href: '/faq', label: '자주 묻는 질문' },
  { href: '/support/contact', label: '문의하기' },
  { href: '/terms', label: '이용약관' },
  { href: '/privacy', label: '개인정보처리방침' },
] as const;

export function SiteFooter() {
  return (
    <div className="flex flex-col gap-4 border-t border-neutral-border pt-6 text-xs md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-1 text-neutral-muted">
        <span className="font-kopub text-caption uppercase tracking-widest">지원 정보</span>
        <span>{siteConfig.name}</span>
      </div>
      <nav aria-label="지원 정보" className="flex flex-wrap gap-3">
        {SUPPORT_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="text-link">
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export default SiteFooter;
