import './globals.css';
import type { Metadata, Viewport } from 'next';
import { headers as nextHeaders } from 'next/headers';
import type { ReactNode } from 'react';

import { ServiceWorkerRegister } from './sw-register';
import { Providers } from './providers';
import { HeaderGate } from '../components/header-gate';
import { Analytics } from '../components/analytics';
import WebVitalsReporter from '../components/web-vitals-reporter';
import { siteConfig, ogImage } from '../lib/site';
import { fontSans, fontMenu, fontKoPubDotum } from './fonts';

const metadataUrl = new URL(siteConfig.url);
const ogImageUrl = new URL(ogImage.path, siteConfig.url);

export const metadata: Metadata = {
  metadataBase: metadataUrl,
  applicationName: siteConfig.shortName,
  category: 'organization',
  title: {
    default: `${siteConfig.name} 웹 서비스`,
    template: `%s | ${siteConfig.name}`
  },
  description: siteConfig.description,
  keywords: ['총동문회', '서강대학교 경제대학원', '동문 수첩', '총회', '행사', 'FAQ'],
  authors: [{ name: siteConfig.name }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: siteConfig.name,
    title: `${siteConfig.name} 웹 서비스`,
    description: siteConfig.description,
    url: siteConfig.url,
    images: [
      {
        url: ogImageUrl.toString(),
        width: 1200,
        height: 630,
        alt: ogImage.alt,
        type: 'image/png'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteConfig.name} 웹 서비스`,
    description: siteConfig.description,
    images: [ogImageUrl.toString()]
  },
  alternates: {
    canonical: siteConfig.url,
    languages: {
      ko: siteConfig.url
    }
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true
    }
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
};

export default function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  const getRequestHeaders: () => Headers = nextHeaders;
  const requestHeaders = getRequestHeaders();
  const nonceValue = requestHeaders.get('x-nonce');
  const nonce = nonceValue ?? undefined;

  return (
    <html lang="ko" className={`${fontSans.variable} ${fontMenu.variable} ${fontKoPubDotum.variable} antialiased`}>
      <body>
        <a className="skip-link" href="#main-content">
          본문 바로가기
        </a>
        {/* CI/운영 안정화를 위해 SW는 명시적 플래그가 있을 때만 등록 */}
        {process.env.NEXT_PUBLIC_ENABLE_SW === '1' ? <ServiceWorkerRegister /> : null}
        <Providers>
          <Analytics nonce={nonce} />
          <WebVitalsReporter />
          <HeaderGate />
          <main id="main-content" role="main" tabIndex={-1}>
            {children}
          </main>
          <footer className="site-footer" role="contentinfo">
            Public alumni app scaffold — local use only for now.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
