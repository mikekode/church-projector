
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Creenly | AI Church Projector Software & Worship Presentation",
    description: "The world's first AI church projector software. Automatically detect and project Bible verses in real-time. Better than ProPresenter for volunteers.",
    keywords: ["church projector software", "worship presentation software", "free church projection software", "AI bible verse projector", "ProPresenter alternative", "EasyWorship alternative"],
    openGraph: {
        title: "Creenly | AI Church Projector Software",
        description: "Zero-Click worship presentation software that listens to your service.",
        url: "https://www.creenly.com",
        siteName: "Creenly",
        images: [
            {
                url: "/logo.png",
                width: 800,
                height: 600,
            },
        ],
        locale: "en_US",
        type: "website",
    },
    icons: {
        icon: [
            { url: "/logo.png", sizes: "32x32", type: "image/png" },
            { url: "/logo.png", sizes: "192x192", type: "image/png" },
            { url: "/logo.png", sizes: "512x512", type: "image/png" },
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
        <html lang="en">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Libre+Baskerville:wght@400;700&display=swap" rel="stylesheet" />
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            "@context": "https://schema.org",
                            "@type": "SoftwareApplication",
                            "name": "Creenly",
                            "operatingSystem": "Windows, macOS",
                            "applicationCategory": "MultimediaApplication",
                            "aggregateRating": {
                                "@type": "AggregateRating",
                                "ratingValue": "4.9",
                                "ratingCount": "128"
                            },
                            "offers": {
                                "@type": "Offer",
                                "price": "15.00",
                                "priceCurrency": "USD"
                            }
                        })
                    }}
                />
            </head>
            <body className={`font-sans bg-black text-white antialiased`}>{children}</body>
        </html>
    );
}
