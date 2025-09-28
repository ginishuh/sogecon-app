import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { ServiceWorkerRegister } from './sw-register';

export const metadata: Metadata = {
  title: 'Alumni Web App',
  description: 'Public alumni app scaffold built with Next.js'
};

export default function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <ServiceWorkerRegister />
        <header className="flex flex-col gap-2 border-b border-slate-200 pb-4">
          <h1 className="text-2xl font-semibold text-brand-primary">Alumni Web App</h1>
          <nav className="flex gap-4 text-sm">
            <Link href="/">홈</Link>
            <Link href="/posts">게시글</Link>
            <Link href="/events">행사</Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="mt-auto pt-8 text-xs text-slate-500">
          Public alumni app scaffold — local use only for now.
        </footer>
      </body>
    </html>
  );
}
