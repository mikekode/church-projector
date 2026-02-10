
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    metadataBase: new URL('https://www.creenly.com'),
    title: "Creenly | AI Church Projector Software - Auto Bible Verse Display",
    description: "The world's first AI church projector software. Automatically detect and project Bible verses in real-time during sermons. Easier than ProPresenter, smarter than EasyWorship. Used by 500+ churches. Free download.",
    keywords: [
        // Primary keywords
        "church projector software",
        "worship presentation software",
        "AI Bible verse projector",
        "ProPresenter alternative",
        "EasyWorship alternative",
        // Long-tail keywords (high intent, lower competition)
        "free church projection software download",
        "automatic Bible verse display software",
        "church presentation software for volunteers",
        "AI sermon scripture projector",
        "best church projector software 2025",
        "easy worship software for small churches",
        "church lyrics projection software",
        "Sunday service presentation software",
        "real-time Bible verse detection",
        "voice activated church projector",
        // Feature keywords
        "ATEM church integration software",
        "MIDI church presentation",
        "multiple Bible version projector"
    ],
    openGraph: {
        title: "Creenly | AI Church Projector Software - Automatic Scripture Display",
        description: "Zero-Click AI listens to your pastor and projects Bible verses automatically. 500+ churches trust Creenly. Free download for Windows & Mac.",
        url: "https://www.creenly.com",
        siteName: "Creenly",
        images: [
            {
                url: "/og-image.png",
                width: 1200,
                height: 630,
                alt: "Creenly AI Church Projector Software - Automatic Bible Verse Display"
            },
        ],
        locale: "en_US",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "Creenly | AI Church Projector - Auto Bible Verse Display",
        description: "AI listens to sermons and projects scriptures automatically. Used by 500+ churches. Free download.",
        images: ["/og-image.png"],
        creator: "@creaboratehq",
    },
    alternates: {
        canonical: "https://www.creenly.com",
    },
    verification: {
        google: "google-site-verification-placeholder", // Replace with actual code from GSC
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
        },
    },
    icons: {
        icon: [
            { url: "/logo.png" },
            { url: "/logo.png", sizes: "32x32", type: "image/png" },
            { url: "/logo.png", sizes: "48x48", type: "image/png" },
            { url: "/logo.png", sizes: "96x96", type: "image/png" },
            { url: "/logo.png", sizes: "144x144", type: "image/png" },
            { url: "/logo.png", sizes: "192x192", type: "image/png" },
        ],
        shortcut: "/logo.png",
        apple: "/logo.png",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="dark">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Libre+Baskerville:wght@400;700&display=swap" rel="stylesheet" />
                {/* FOUC Prevention for Light Mode */}
                <script dangerouslySetInnerHTML={{
                    __html: `
                    (function() {
                        try {
                            var theme = localStorage.getItem('creenly-theme') || 'dark';
                            if (theme === 'dark') {
                                document.documentElement.classList.add('dark');
                            } else {
                                document.documentElement.classList.remove('dark');
                            }
                        } catch (e) {}
                    })();
                `}} />
                {/* SoftwareApplication Schema */}
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            "@context": "https://schema.org",
                            "@type": "SoftwareApplication",
                            "name": "Creenly",
                            "alternateName": "Creenly AI Church Projector",
                            "description": "AI-powered church projector software that automatically detects and displays Bible verses during sermons",
                            "operatingSystem": "Windows 10, Windows 11, macOS 12.0+",
                            "applicationCategory": "MultimediaApplication",
                            "applicationSubCategory": "Church Presentation Software",
                            "aggregateRating": {
                                "@type": "AggregateRating",
                                "ratingValue": "4.9",
                                "ratingCount": "128",
                                "bestRating": "5",
                                "worstRating": "1"
                            },
                            "offers": {
                                "@type": "Offer",
                                "price": "15.00",
                                "priceCurrency": "USD",
                                "priceValidUntil": "2026-12-31",
                                "availability": "https://schema.org/InStock"
                            },
                            "downloadUrl": "https://www.creenly.com/#download-section",
                            "screenshot": "https://www.creenly.com/screenshot.png",
                            "featureList": "AI Voice Recognition, Automatic Bible Verse Detection, Multiple Bible Versions, ATEM Integration, MIDI Support, Cloud Song Library"
                        })
                    }}
                />
                {/* Organization Schema */}
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            "@context": "https://schema.org",
                            "@type": "Organization",
                            "name": "Creenly",
                            "url": "https://www.creenly.com",
                            "logo": "https://www.creenly.com/logo.png",
                            "description": "AI-powered church projection software for modern worship",
                            "email": "michael@creenly.com",
                            "sameAs": [
                                "https://twitter.com/creaboratehq"
                            ]
                        })
                    }}
                />
                {/* FAQ Schema for Rich Snippets */}
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            "@context": "https://schema.org",
                            "@type": "FAQPage",
                            "mainEntity": [
                                {
                                    "@type": "Question",
                                    "name": "What is Creenly church projector software?",
                                    "acceptedAnswer": {
                                        "@type": "Answer",
                                        "text": "Creenly is AI-powered church presentation software that automatically listens to sermons and projects Bible verses in real-time. It's designed to be easier than ProPresenter and smarter than EasyWorship, perfect for volunteer-run churches."
                                    }
                                },
                                {
                                    "@type": "Question",
                                    "name": "How much does Creenly cost?",
                                    "acceptedAnswer": {
                                        "@type": "Answer",
                                        "text": "Creenly costs $15/month or $150/year (save $30). All plans include AI voice recognition, unlimited Bible versions, ATEM & MIDI integration, cloud song library, and priority support. There's also a 30-day money-back guarantee."
                                    }
                                },
                                {
                                    "@type": "Question",
                                    "name": "Is Creenly better than ProPresenter?",
                                    "acceptedAnswer": {
                                        "@type": "Answer",
                                        "text": "Creenly is designed to be easier to use than ProPresenter. While ProPresenter is powerful, it has a steep learning curve. Creenly's AI automatically detects and displays verses, making it ideal for volunteers and small churches. It costs $15/month vs ProPresenter's $40+/month."
                                    }
                                },
                                {
                                    "@type": "Question",
                                    "name": "Does Creenly work on Mac and Windows?",
                                    "acceptedAnswer": {
                                        "@type": "Answer",
                                        "text": "Yes, Creenly works on both Windows (10/11) and macOS (12.0 or later). Download the appropriate installer from our website and you'll be up and running in minutes."
                                    }
                                },
                                {
                                    "@type": "Question",
                                    "name": "What Bible versions does Creenly support?",
                                    "acceptedAnswer": {
                                        "@type": "Answer",
                                        "text": "Creenly supports 15+ Bible versions including KJV, NIV, ESV, NKJV, NLT, NASB, CSB, MSG, AMP, TPT, and more. You can switch versions instantly during your service."
                                    }
                                }
                            ]
                        })
                    }}
                />
            </head>
            <body className={`font-sans antialiased`}>{children}</body>
        </html>
    );
}
