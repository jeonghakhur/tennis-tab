import type { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tennis-tab.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/my/',
          '/auth/',
          '/api/',
          '/tournaments/*/payment/',
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  }
}
