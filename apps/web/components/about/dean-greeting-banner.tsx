import Image from 'next/image';
import React from 'react';

type DeanGreetingBannerProps = {
  priority?: boolean;
};

export function DeanGreetingBanner({ priority = false }: DeanGreetingBannerProps) {
  return (
    <section aria-labelledby="dean-greeting-title" className="relative aspect-[1200/670] overflow-hidden rounded-3xl bg-brand-900 shadow-soft max-[240px]:aspect-auto max-[240px]:min-h-56">
      <Image
        src="/images/about/dean-kim-doyoung-banner.webp"
        alt=""
        fill
        className="object-cover object-center max-[240px]:hidden"
        sizes="(min-width: 1280px) 72rem, 100vw"
        priority={priority}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(90deg,rgba(86,5,20,0.96)_0%,rgba(86,5,20,0.8)_40%,rgba(86,5,20,0)_58%)]"
      />
      <div className="relative z-10 flex h-full max-w-[58%] flex-col justify-center p-6 text-white sm:p-10 lg:p-14 max-[240px]:max-w-full max-[240px]:p-4">
        <p className="text-xs font-semibold text-white/70 sm:text-sm">
          대학원장 인사말
        </p>
        <h1 id="dean-greeting-title" className="mt-3 break-keep font-heading text-xl font-bold leading-tight text-white drop-shadow-sm sm:text-4xl lg:text-5xl">
          우리 서강경제에서<br />여러분의 미래를<br className="sm:hidden" /> 창조하십시오.
        </h1>
        <p className="mt-auto hidden text-xs font-medium text-white/90 sm:block sm:text-base">
          서강대학교 경제대학원장 <strong className="font-bold text-white">김도영</strong> 드림
        </p>
      </div>
    </section>
  );
}
