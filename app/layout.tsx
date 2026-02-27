import type { Metadata } from 'next';
import './globals.css'; // Global styles
import { DealCacheProvider } from '@/components/DealCacheProvider';
import { Analytics } from '@vercel/analytics/next';

export const metadata: Metadata = {
  title: 'Consensus',
  description: 'AI-powered business acquisition intelligence platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <DealCacheProvider>{children}</DealCacheProvider>
        <Analytics />
      </body>
    </html>
  );
}
