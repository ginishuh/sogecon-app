import type { MetadataRoute } from 'next';

import { siteConfig } from '../lib/site';

const staticPaths = ['/', '/about/greeting', '/about/org', '/about/history', '/posts', '/events', '/offline'];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url.replace(/\/$/, '');
  const now = new Date();
  return staticPaths.map((path) => ({
    url: `${base}${path === '/' ? '' : path}`,
    lastModified: now,
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : 0.6
  }));
}
