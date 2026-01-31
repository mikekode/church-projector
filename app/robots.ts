import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/dashboard/', '/projector/', '/stage/', '/signage/', '/api/'],
        },
        sitemap: 'https://www.creenly.com/sitemap.xml',
    }
}
