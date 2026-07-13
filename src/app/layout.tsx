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

export const metadata: Metadata = {
  title: 'Coloury — AI-Assisted Photo Editor',
  description: 'Lightroom-style non-destructive photo editing in the browser.',
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
