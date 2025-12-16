// 서비스 워커 활성화 정책 (dev 기본 off, 필요 시 NEXT_PUBLIC_ENABLE_SW=1)

export function isServiceWorkerEnabled(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ENABLE_SW === '1';
}

