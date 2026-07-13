import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
