import { isValidElement, type ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { AboutHeroPhoto } from '../components/about/about-hero-photo';

describe('AboutHeroPhoto', () => {
  it('passes the priority option to the Next image', () => {
    const hero = AboutHeroPhoto({ src: '/hero.webp', alt: '상단 사진', priority: true });
    expect(isValidElement(hero)).toBe(true);

    const image = hero.props.children as ReactElement<{ priority?: boolean }>;
    expect(image.props.priority).toBe(true);
  });
});
