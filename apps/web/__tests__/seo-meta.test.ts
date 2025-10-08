import { describe, expect, it } from 'vitest';

import { metadata } from '../app/layout';
import sitemap from '../app/sitemap';
import robots from '../app/robots';

describe('SEO metadata configuration', () => {
  it('declares title template and open graph baseline', () => {
    expect(metadata.title).toMatchObject({
      default: '서강대 경제대학원 총원우회',
      template: expect.stringContaining('%s')
    });
    expect(metadata.openGraph?.images?.[0]?.url).toContain('default-og.svg');
    expect(metadata).toMatchSnapshot();
  });

  it('includes about routes in sitemap', () => {
    const entries = sitemap();
    const urls = entries.map((entry) => entry.url);
    expect(urls).toEqual(expect.arrayContaining([
      expect.stringContaining('/about/greeting'),
      expect.stringContaining('/about/org'),
      expect.stringContaining('/about/history')
    ]));
  });

  it('allows crawling and references sitemap in robots config', () => {
    const config = robots();
    expect(config.rules?.[0]?.allow).toBe('/');
    expect(config.sitemap?.[0]).toContain('/sitemap.xml');
    expect(config.host).toBeDefined();
  });
});
