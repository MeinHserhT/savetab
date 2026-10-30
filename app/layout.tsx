import type { Metadata } from 'next';
import {
  Plus_Jakarta_Sans,
  Be_Vietnam_Pro,
  JetBrains_Mono,
} from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin', 'vietnamese'],
  weight: ['600', '700'],
  variable: '--font-display',
  display: 'swap',
});

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TabFlow — Swiss Minimalist Link Curation & Research Board',
  description:
    'Swiss Minimalist Save-Links-for-Later research board with defensive OpenGraph scraping, multi-lane Kanban workflow, and high-thinking synthesis.',
  icons: {
    icon: [
      { url: '/assets/aistudio/UxYOWWa01.svg', type: 'image/svg+xml' },
      { url: '/assets/aistudio/logo-mark.png', type: 'image/png' },
    ],
    shortcut: '/assets/aistudio/logo-mark.png',
    apple: '/assets/aistudio/logo-mark.png',
  },
  openGraph: {
    title: 'TabFlow — Swiss Minimalist Link Curation & Research Board',
    description:
      'Swiss Minimalist Save-Links-for-Later research board with defensive OpenGraph scraping, multi-lane Kanban workflow, and high-thinking synthesis.',
    type: 'website',
    images: ['/assets/aistudio/logo-mark.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TabFlow — Swiss Minimalist Link Curation & Research Board',
    description:
      'Swiss Minimalist Save-Links-for-Later research board with defensive OpenGraph scraping, multi-lane Kanban workflow, and high-thinking synthesis.',
    images: ['/assets/aistudio/logo-mark.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="vi"
      className={`dark ${plusJakarta.variable} ${beVietnamPro.variable} ${jetbrainsMono.variable}`}
    >
      <body
        suppressHydrationWarning
        className="min-h-screen bg-[var(--tf-canvas)] font-sans text-[var(--tf-text)] antialiased"
      >
        {children}
      </body>
    </html>
  );
}
