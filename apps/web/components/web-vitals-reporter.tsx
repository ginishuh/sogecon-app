"use client";

import { useEffect } from 'react';
import type { Metric } from 'web-vitals';
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';

import { API_BASE } from '../lib/api';

const vitalsUrl = `${API_BASE.replace(/\/$/, '')}/rum/vitals`;

function getDevice(): string {
  if (typeof window === 'undefined') return 'server';
  return window.innerWidth <= 768 ? 'mobile' : 'desktop';
}

export function postWebVital(body: string) {
  if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
    try {
      // sendBeacon은 Blob으로 Content-Type 지정 필요
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(vitalsUrl, blob)) return;
    } catch {
      // beacon을 사용할 수 없으면 keepalive fetch로 한 번만 대체합니다.
    }
  }
  void fetch(vitalsUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

export function buildWebVitalPayload(metric: Metric) {
  return {
    name: metric.name,
    id: metric.id,
    value: Math.round(metric.value * 100) / 100,
    delta: Math.round((metric.delta ?? 0) * 100) / 100,
    rating: metric.rating,
    path: typeof window !== 'undefined' ? window.location.pathname : '',
    navType: metric.navigationType,
    device: getDevice(),
    commit: process.env.NEXT_PUBLIC_COMMIT_SHA || '',
    ts: Date.now(),
  };
}

function send(metric: Metric) {
  try {
    const body = JSON.stringify(buildWebVitalPayload(metric));
    postWebVital(body);
  } catch {
    // RUM 수집 실패는 사용자 화면과 앱 동작에 영향을 주지 않습니다.
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
