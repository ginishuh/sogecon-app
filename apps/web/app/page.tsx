import React from 'react';
import { HomeQuickActions } from '../components/home/quick-actions';
import HomeHeroCarousel from '../components/home/hero-carousel';
import HomeDesktopCards from '../components/home/desktop-cards';
import HomeNoticeList from '../components/home/notice-list';
import { HomeGreetingCard } from '../components/home/greeting-card';

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* 접근성/SEO용 H1 */}
      <h1 className="sr-only">서강대 경제대학원 총동문회</h1>

      {/* 히어로 캐러셀 */}
      <div className="mb-4">
        <HomeHeroCarousel />
      </div>

      {/* 퀵 액션 타일 (6개 버튼) */}
      <HomeQuickActions />

      {/* PC 전용: 공지/행사/소식 카드 */}
      <div className="hidden lg:block">
        <HomeDesktopCards />
      </div>

      {/* 모바일/태블릿: 공지사항 리스트 */}
      <div className="lg:hidden">
        <HomeNoticeList />
      </div>

      {/* 동문회장 인사말 */}
      <HomeGreetingCard />
    </div>
  );
}
