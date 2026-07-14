import React, { type ReactNode } from 'react';

type AboutHeroProps = {
  title: string;
  description: string;
  media: ReactNode;
};

export function AboutHero({ title, description, media }: AboutHeroProps) {
  return (
    <section aria-labelledby="about-hero-heading" className="about-hero">
      <div className="about-hero__text">
        <p className="about-hero__eyebrow">총동문회 소개</p>
        <h1 id="about-hero-heading" className="about-hero__title break-keep">
          {title}
        </h1>
        <p className="about-hero__description">{description}</p>
      </div>
      <div className="about-hero__media">
        {media}
      </div>
    </section>
  );
}
