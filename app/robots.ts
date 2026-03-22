import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/trades', '/backtesting', '/systems', '/settings'],
      },
    ],
    sitemap: 'https://tradeinsystems.com/sitemap.xml',
    host: 'https://tradeinsystems.com',
  }
}
