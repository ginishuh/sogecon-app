"use client";

import { SiteHeader } from './site-header';

// 로그인 페이지에서도 헤더를 그대로 노출합니다.
export function HeaderGate() {
  return <SiteHeader />;
}
