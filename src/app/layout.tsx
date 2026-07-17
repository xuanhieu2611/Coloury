import type { Metadata } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Mono, Syne } from 'next/font/google';
import './globals.css';

const ui = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ui',
  display: 'swap',
});

const brand = Syne({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-brand',
  display: 'swap',
});

const data = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-data',
  display: 'swap',
});

// Absolute base for OG/Twitter image URLs. Vercel injects VERCEL_URL at build;
// fall back to localhost for local dev. Override with SITE_URL once a domain is set.
const siteUrl = process.env.SITE_URL
  ? process.env.SITE_URL
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Coloury — Film-grade color, right in your browser',
  description:
    'Real film LUTs, AI auto-editing, and a full manual cockpit. Grade your photos with the color of a proper edit — no app, no upload, no watermark. Free to use.',
  openGraph: {
    title: 'Coloury — Film-grade color, right in your browser',
    description:
      'Real film LUTs, AI auto-editing, and a full manual cockpit — free to use, nothing to install.',
    type: 'website',
    images: ['/marketing/hero-after.jpg'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${ui.variable} ${brand.variable} ${data.variable}`}>
      <body>{children}</body>
    </html>
  );
}
