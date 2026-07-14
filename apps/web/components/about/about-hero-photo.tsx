import Image from 'next/image';
import React from 'react';

type AboutHeroPhotoProps = {
  src: string;
  alt: string;
  objectPosition?: string;
  priority?: boolean;
};

export function AboutHeroPhoto({ src, alt, objectPosition = 'center', priority = false }: AboutHeroPhotoProps) {
  return (
    <div className="relative aspect-[3/2] w-full overflow-hidden rounded-2xl bg-surface-sunken">
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes="(max-width: 767px) calc(100vw - 80px), (max-width: 1279px) 36vw, 27rem"
        className="object-cover"
        style={{ objectPosition }}
      />
    </div>
  );
}
