import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FINDEX — Aotearoa Fish Field Guide',
  description: 'An old-school field guide for a new fishing adventure. Discover New Zealand fish and marine wildlife, and keep a private, offline catch and sighting journal.',
  applicationName: 'FINDEX',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'FINDEX' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit:'cover', themeColor: '#c23e3f' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-NZ"><body>{children}<Analytics /></body></html>;
}
