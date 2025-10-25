import Image from 'next/image';
import React from 'react';

type AboutHeroProps = {
  title: string;
  description: string;
  image: {
    src: string;
    alt: string;
    priority?: boolean;
  };
};

export function AboutHero({ title, description, image }: AboutHeroProps) {
  return (
    <section aria-labelledby="about-hero-heading" className="about-hero">
      <div className="about-hero__text">
        <p className="about-hero__eyebrow">총동문회 소개</p>
        <h1 id="about-hero-heading" className="about-hero__title">
          {title}
        </h1>
        <p className="about-hero__description">{description}</p>
      </div>
      <div className="about-hero__image">
        <Image
          alt={image.alt}
          src={image.src}
          width={640}
          height={480}
          className="h-full w-full rounded-xl object-cover shadow-md"
          priority={image.priority}
        />
      </div>
    </section>
  );
}
