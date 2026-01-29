
import type { Metadata } from "next";
import { Inter, Libre_Baskerville } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: '--font-inter' });
const libre = Libre_Baskerville({
    weight: ['400', '700'],
    subsets: ["latin"],
    variable: '--font-libre'
});

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
            <body className={`${inter.variable} ${libre.variable} font-sans bg-black text-white antialiased`}>{children}</body>
        </html>
    );
}
