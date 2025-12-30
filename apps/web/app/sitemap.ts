import type { MetadataRoute } from 'next';

import { siteConfig } from '../lib/site';

const staticPaths = [
  '/',
  '/about/greeting',
  '/about/dean-greeting',
  '/about/org',
  '/about/history',
  '/directory',
  '/faq',
  '/privacy',
  '/terms',
  '/posts',
  '/events',
  '/offline'
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url.replace(/\/$/, '');
  const now = new Date();
  return staticPaths.map((path) => ({
    url: `${base}${path === '/' ? '' : path}`,
    lastModified: now,
    changeFrequency:
      path === '/'
        ? 'weekly'
        : ['/posts', '/events', '/directory'].includes(path)
          ? 'weekly'
          : ['/faq', '/privacy', '/terms'].includes(path)
            ? 'yearly'
            : 'monthly',
    priority: path === '/' ? 1 : 0.6
  }));
}
