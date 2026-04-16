import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://tutorial.sedifex.com'),
  title: {
    default: 'Sedifex Tutorials',
    template: '%s | Sedifex Tutorials'
  },
  description: 'Beginner-friendly guides for Sedifex inventory, POS, and business operations workflows.',
  openGraph: {
    title: 'Sedifex Tutorials',
    description: 'Learn Sedifex quickly with practical, role-based tutorials for owners, staff, and operations teams.',
    url: 'https://tutorial.sedifex.com',
    siteName: 'Sedifex Tutorials',
    type: 'website'
  },
  alternates: {
    canonical: 'https://tutorial.sedifex.com'
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
