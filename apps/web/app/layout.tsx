import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { ServiceWorkerRegister } from './sw-register';
import { Providers } from './providers';
import { SiteHeader } from '../components/site-header';
import { Analytics } from '../components/analytics';
import { siteConfig, ogImage } from '../lib/site';

const metadataUrl = new URL(siteConfig.url);
const ogImageUrl = new URL(ogImage.path, siteConfig.url);

export const metadata: Metadata = {
  metadataBase: metadataUrl,
  title: {
    default: `${siteConfig.name}`,
    template: `%s | ${siteConfig.name}`
  },
  description: siteConfig.description,
  keywords: ['총원우회', '서강대학교', '경제대학원', '동문회', '행사'],
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.url,
    images: [
      {
        url: ogImageUrl.toString(),
        width: 1200,
        height: 630,
        alt: ogImage.alt
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: siteConfig.name,
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

export default function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        {/* Dev에서 SW가 RSC 스트림을 끊는 것을 피하기 위해 prod/NEXT_PUBLIC_ENABLE_SW=1 에서만 렌더 */}
        {(process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ENABLE_SW === '1') && (
          <ServiceWorkerRegister />
        )}
        <Providers>
          <Analytics />
          <a className="skip-link" href="#main-content">
            본문 바로가기
          </a>
          <SiteHeader />
          <main id="main-content" role="main">
            {children}
          </main>
          <footer className="site-footer">
            Public alumni app scaffold — local use only for now.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
