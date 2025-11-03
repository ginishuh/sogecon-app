"use client";

import FigmaHeader from './figma-header';
import { SiteHeader } from './site-header';

// 헤더 게이트: 기본은 새 톤(FigmaHeader). 환경/옵션에 따라 구(舊) 헤더로 전환 가능.
export function HeaderGate() {
  const useLegacy = false; // 필요 시 토글
  return useLegacy ? <SiteHeader /> : <FigmaHeader />;
}
