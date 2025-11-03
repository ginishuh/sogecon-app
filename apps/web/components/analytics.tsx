import Script from 'next/script';
import React from 'react';

const measurementId = process.env.NEXT_PUBLIC_ANALYTICS_ID;

type AnalyticsProps = {
  nonce?: string;
};

export function Analytics({ nonce }: AnalyticsProps) {
  if (!measurementId) {
    return null;
  }

  const bootstrap = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){window.dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${measurementId}', { anonymize_ip: true });
  `;

  return (
    <>
      {/* 프로덕션 도메인 확정 전까지는 환경변수로 가드하고, 기본 페이지뷰만 기록 */}
      <Script id="ga-loader" nonce={nonce} src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
      <Script id="ga-inline" nonce={nonce} strategy="afterInteractive">{bootstrap}</Script>
    </>
  );
}
