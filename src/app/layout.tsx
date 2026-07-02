import type { Metadata } from 'next';
import { DM_Sans, Playfair_Display } from 'next/font/google';
import { Providers } from './providers';
import '../styles/globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'NY Locale Official Online Store - Order Now!',
  description: 'Fresh coffee, crafted for New York.',
  icons: { icon: '/favicon.ico' },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${dmSans.variable} ${playfair.variable}`}>
      <head>
        <meta charSet="utf-8" />
      </head>
      <body className="bg-coffee-50 text-coffee-900 antialiased font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
