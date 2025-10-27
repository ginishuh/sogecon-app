"use client";

import { useEffect } from 'react';
import type { Metric } from 'web-vitals';
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';

const url = '/rum/vitals';

function getNavType(): string | undefined {
  if (typeof performance === 'undefined') return undefined;
  const entry = performance.getEntriesByType?.('navigation')?.[0] as
    | PerformanceNavigationTiming
    | undefined;
  return entry?.type;
}

function getDevice(): string {
  if (typeof window === 'undefined') return 'server';
  return window.innerWidth <= 768 ? 'mobile' : 'desktop';
}

function post(body: string) {
  if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
    navigator.sendBeacon(url, body);
  } else {
    void fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  }
}

function send(metric: Metric) {
  try {
    const body = JSON.stringify({
      name: metric.name,
      id: metric.id,
      value: Math.round(metric.value * 100) / 100,
      delta: Math.round((metric.delta ?? 0) * 100) / 100,
      path: typeof window !== 'undefined' ? window.location.pathname : '',
      navType: getNavType(),
      device: getDevice(),
      commit: process.env.NEXT_PUBLIC_COMMIT_SHA || '',
      ts: Date.now(),
    });
    post(body);
  } catch {
    /* ignore */
  }
}

export default function WebVitalsReporter() {
  useEffect(() => {
    onLCP(send);
    onINP(send);
    onCLS(send);
    onFCP(send);
    onTTFB(send);
  }, []);
  return null;
}
