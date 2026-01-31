
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Creenly",
    description: "Real-time bible verse projection system",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <head>
                <meta httpEquiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' https://ejqzexdkoqbvgmjtbbwd.supabase.co https://*.googleapis.com https://*.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' https:;" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Libre+Baskerville:wght@400;700&display=swap" rel="stylesheet" />
            </head>
            <body className={`font-sans bg-black text-white antialiased`}>{children}</body>
        </html>
    );
}
