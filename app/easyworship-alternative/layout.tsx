import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Best EasyWorship Alternative 2025 | Creenly AI Church Projector',
    description: 'Looking for an EasyWorship alternative that works on Mac? Creenly has AI-powered Bible verse detection, cross-platform support, and costs just $15/month. Free download.',
    keywords: [
        'EasyWorship alternative',
        'EasyWorship alternative Mac',
        'EasyWorship alternative free',
        'best EasyWorship alternative',
        'EasyWorship vs Creenly',
        'church presentation software Mac',
        'worship software like EasyWorship',
        'EasyWorship replacement',
        'better than EasyWorship'
    ],
    openGraph: {
        title: 'Best EasyWorship Alternative - Creenly AI Church Projector',
        description: 'AI-powered worship software for Mac & Windows. Automatic Bible verse detection. Works where EasyWorship doesn\'t.',
        url: 'https://www.creenly.com/easyworship-alternative',
        siteName: 'Creenly',
        images: [
            {
                url: '/og-easyworship.png',
                width: 1200,
                height: 630,
                alt: 'Creenly vs EasyWorship Comparison'
            }
        ],
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Best EasyWorship Alternative 2025 | Creenly',
        description: 'AI church projector for Mac & Windows. Automatic verse detection.',
        images: ['/og-easyworship.png'],
    },
    alternates: {
        canonical: 'https://www.creenly.com/easyworship-alternative',
    },
};

export default function EasyWorshipAlternativeLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
