import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Best ProPresenter Alternative 2025 | Creenly AI Church Projector',
    description: 'Looking for a ProPresenter alternative? Creenly is AI-powered church presentation software that costs $15/month vs $40+. Train volunteers in minutes, not weeks. Free download.',
    keywords: [
        'ProPresenter alternative',
        'ProPresenter alternative free',
        'best ProPresenter alternative',
        'cheaper than ProPresenter',
        'ProPresenter vs Creenly',
        'church presentation software',
        'worship software like ProPresenter',
        'ProPresenter replacement',
        'easy church projector software'
    ],
    openGraph: {
        title: 'Best ProPresenter Alternative - Creenly AI Church Projector',
        description: 'AI-powered worship software at $15/month vs ProPresenter\'s $40+. Automatic Bible verse detection. Train volunteers in minutes.',
        url: 'https://www.creenly.com/propresenter-alternative',
        siteName: 'Creenly',
        images: [
            {
                url: '/og-propresenter.png',
                width: 1200,
                height: 630,
                alt: 'Creenly vs ProPresenter Comparison'
            }
        ],
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Best ProPresenter Alternative 2025 | Creenly',
        description: 'AI church projector at $15/month vs $40+. Automatic verse detection.',
        images: ['/og-propresenter.png'],
    },
    alternates: {
        canonical: 'https://www.creenly.com/propresenter-alternative',
    },
};

export default function ProPresenterAlternativeLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
