import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Providers } from '@/providers';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'], display: 'swap' });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: {
    default: 'Vision IT Infra',
    template: '%s · Vision IT Infra',
  },
  description:
    'Portfolio catalog, invoicing, AI-assisted client email and double-entry accounting for an independent software studio.',
  icons: { icon: '/favicon.ico' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1220' },
  ],
  width: 'device-width',
  initialScale: 1,
};

/**
 * The inline script applies the stored theme before first paint. Without it the
 * page renders light, then snaps to dark once React hydrates — a visible flash
 * on every load for dark-mode users.
 */
const themeBootstrap = `
(function () {
  try {
    var stored = localStorage.getItem('vii-ui');
    var theme = stored ? (JSON.parse(stored).state || {}).theme : 'system';
    var dark = theme === 'dark' ||
      ((!theme || theme === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
