import type { Metadata } from "next";
import "./globals.css"; // Global styles
import { DealCacheProvider } from "@/components/DealCacheProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: "Consensus",
  description: "AI-powered business acquisition intelligence platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <AuthProvider>
            <DealCacheProvider>{children}</DealCacheProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
