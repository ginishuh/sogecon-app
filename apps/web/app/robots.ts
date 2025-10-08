import type { MetadataRoute } from 'next';

import { siteConfig } from '../lib/site';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = new URL(siteConfig.url);
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/posts/new', '/events/new']
      }
    ],
    sitemap: [`${baseUrl.origin}/sitemap.xml`],
    host: baseUrl.host
  };
}
