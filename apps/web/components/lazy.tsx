/**
 * 동적 임포트 컴포넌트 모음
 * - SSR 비활성화가 필요한 컴포넌트들을 한 곳에서 관리
 * - 중복 dynamic() 호출 방지
 */
import dynamic from 'next/dynamic';

/**
 * DrawerMenu — SSR 비활성화 (클라이언트 전용)
 * useRouter, useState 등 클라이언트 훅 사용으로 SSR 불가
 */
export const LazyDrawerMenu = dynamic(
  () => import('./drawer-menu').then((mod) => ({ default: mod.DrawerMenu })),
  { ssr: false }
);
