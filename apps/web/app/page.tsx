import React from 'react';
import { HomeQuickActions } from '../components/home/quick-actions';
import HomeHeroCarousel from '../components/home/hero-carousel';
import HomeDesktopCards from '../components/home/desktop-cards';
import { HomeGreetingCard } from '../components/home/greeting-card';

export default function HomePage() {
  return (
    <div className="home-page flex min-w-0 flex-col">
      {/* 접근성/SEO용 H1 */}
      <h1 className="sr-only">서강대 경제대학원 총동문회</h1>

      {/* 히어로 캐러셀 */}
      <div className="min-w-0 overflow-clip">
        <HomeHeroCarousel />
      </div>

      {/* 현재 로그인 상태에 맞는 핵심 행동 */}
      <HomeQuickActions />

      {/* 모든 화면에서 같은 순서로 보는 현재 활동 */}
      <HomeDesktopCards />

      {/* 인사말 */}
      <HomeGreetingCard />
    </div>
  );
}
