import type { Session } from '../services/auth';

const EXEMPT_PATHS = new Set([
  '/directory-consent',
  '/privacy',
  '/terms',
  '/faq',
  '/activate',
  '/support/contact',
]);

export function needsDirectoryConsent(session: Session | null | undefined): boolean {
  if (!session || session.kind !== 'member') return false;
  return session.directory_consent_at === null;
}

export function isDirectoryConsentExemptPath(pathname: string): boolean {
  return EXEMPT_PATHS.has(pathname);
}
