
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Creenly Dashboard",
    robots: { index: false }
};

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
