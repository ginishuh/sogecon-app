"use client";

import { type ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Route } from 'next';

import { useAuth } from '../hooks/useAuth';
import { isDirectoryConsentExemptPath, needsDirectoryConsent } from '../lib/directory-consent';

export function DirectoryConsentGate({ children }: { children: ReactNode }) {
  const { status, data } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status !== 'authorized') return;
    if (needsDirectoryConsent(data)) {
      if (!isDirectoryConsentExemptPath(pathname)) {
        router.replace('/directory-consent' as Route);
      }
      return;
    }
    if (
      pathname === '/directory-consent'
      && data?.kind === 'member'
      && Boolean(data.directory_consent_at)
    ) {
      router.replace('/');
    }
  }, [data, pathname, router, status]);

  return <>{children}</>;
}
