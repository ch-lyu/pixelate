import type { Metadata } from 'next';
import { Press_Start_2P, Inter } from 'next/font/google';
import './globals.css';
import '@coinbase/onchainkit/styles.css';
import { Providers } from './providers';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { minikitConfig } from '../minikit.config';

const pixelFont = Press_Start_2P({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-pixel',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const { miniapp } = minikitConfig;

export const metadata: Metadata = {
  title: miniapp.name,
  description: miniapp.description,
  openGraph: {
    title: miniapp.ogTitle,
    description: miniapp.ogDescription,
    images: [miniapp.ogImageUrl],
  },
  other: {
    // Base Mini App verification
    'base:app_id': '6969a16a8aabd019b25f51d8',
    // Farcaster frame meta tags for Mini App embeds
    'fc:frame': 'vNext',
    'fc:frame:image': miniapp.heroImageUrl,
    'fc:frame:button:1': 'Open Pixelate',
    'fc:frame:button:1:action': 'launch_frame',
    'fc:frame:button:1:target': miniapp.homeUrl,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${pixelFont.variable} ${inter.variable}`}>
      <body className="min-h-screen flex flex-col font-sans">
        <Providers>
          <Header />
          <div className="flex-1 flex overflow-hidden">
            {children}
          </div>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
