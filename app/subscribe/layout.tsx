import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Pricing & Plans | Creenly - AI Church Projector Software',
    description: 'Simple, transparent pricing for Creenly AI worship software. $15/month or $150/year. Includes AI voice recognition, unlimited Bible versions, ATEM integration. 30-day money-back guarantee.',
    keywords: [
        'church projector software pricing',
        'worship software subscription',
        'ProPresenter alternative cost',
        'church presentation software price',
        'AI Bible projector subscription',
        'cheap church projection software',
        'affordable worship presentation'
    ],
    openGraph: {
        title: 'Creenly Pricing - AI Church Projector Software',
        description: 'Get AI-powered worship projection for just $15/month. Automatically project Bible verses during sermons.',
        url: 'https://www.creenly.com/subscribe',
        siteName: 'Creenly',
        images: [
            {
                url: '/og-subscribe.png',
                width: 1200,
                height: 630,
                alt: 'Creenly Pricing Plans'
            }
        ],
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Creenly Pricing - $15/month AI Church Projector',
        description: 'Simple pricing for churches. AI voice recognition, unlimited Bible versions, 30-day guarantee.',
        images: ['/og-subscribe.png'],
    },
    alternates: {
        canonical: 'https://www.creenly.com/subscribe',
    },
};

export default function SubscribeLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
