import React from 'react';
import { HomeQuickActions } from '../components/home/quick-actions';
import HomeHeroCarousel from '../components/home/hero-carousel';
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

      {/* 공지사항 리스트 */}
      <HomeNoticeList />

      {/* 동문회장 인사말 */}
      <HomeGreetingCard />
    </div>
  );
}
