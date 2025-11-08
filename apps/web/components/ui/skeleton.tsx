import React from 'react';
import { cn } from '../../lib/cn';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-neutral-surface',
        className
      )}
    />
  );
}

export function HeroSkeleton() {
  return (
    <div className="relative h-[218px] md:h-[400px] lg:h-[591px] overflow-hidden rounded-2xl shadow-xl">
      {/* 배경 스크린 Skeleton */}
      <div className="absolute inset-0 bg-neutral-surface">
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
      </div>
      
      {/* 텍스트 스크린 */}
      <div className="absolute inset-0 flex items-center justify-center px-14 md:px-6 md:items-end md:justify-start md:pb-6 md:pt-16 lg:pt-24">
        <div className="text-center md:text-left max-w-full">
          <div className="h-8 w-64 md:h-9 lg:h-10 bg-white/30 rounded-md mb-2" />
          <div className="h-6 w-full md:w-96 bg-white/20 rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function NoticeSkeleton() {
  return (
    <div className="py-4 border-t border-neutral-border">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="h-5 w-3/4 bg-neutral-surface rounded" />
          <div className="h-5 w-1/2 bg-neutral-surface rounded" />
        </div>
        <div className="h-5 w-16 bg-neutral-surface rounded shrink-0" />
      </div>
    </div>
  );
}
