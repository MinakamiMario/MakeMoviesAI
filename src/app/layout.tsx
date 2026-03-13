import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ToastProvider } from '@/components/ui/Toast';
import Footer from '@/components/Footer';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://makemovies.ai';

export const metadata: Metadata = {
  title: {
    default: 'MakeMovies — Finish films together',
    template: '%s | MakeMovies',
  },
  description: 'A collaborative platform where filmmakers finish stories together. Fork, contribute, and create films as a community.',
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'MakeMovies',
    title: 'MakeMovies — Finish films together',
    description: 'A collaborative platform where filmmakers finish stories together. Fork, contribute, and create films as a community.',
    images: [
      {
        url: `${siteUrl}/api/og`,
        width: 1200,
        height: 630,
        alt: 'MakeMovies — Collaborative Filmmaking Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MakeMovies — Finish films together',
    description: 'A collaborative platform where filmmakers finish stories together.',
    images: [`${siteUrl}/api/og`],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ToastProvider>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <div style={{ flex: 1 }}>{children}</div>
            <Footer />
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
