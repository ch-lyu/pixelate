/**
 * MiniKit Configuration for Pixelate Mini App
 * This file configures the Farcaster manifest and embed metadata.
 */

// Root URL for your deployed Mini App
const ROOT_URL = 'https://pixelate-delta.vercel.app';

export const minikitConfig = {
  // Account association credentials - signed manifest proving app ownership
  accountAssociation: {
    header: '',
    payload: '',
    signature: ''
  },

  // Mini app manifest configuration
  miniapp: {
    // Required fields
    version: '1',
    name: 'Pixelate',
    subtitle: 'Onchain Pixel Canvas',
    description:
      'A shared 64x64 pixel canvas on Base. Like r/place but onchain. Place one pixel every 5 seconds and mint your favorite moments as NFTs.',

    // URLs - these will use ROOT_URL (must be PNG/JPG, not SVG)
    homeUrl: ROOT_URL,
    iconUrl: `${ROOT_URL}/icon.png`,
    splashImageUrl: `${ROOT_URL}/splash.png`,
    splashBackgroundColor: '#121212',

    // Optional fields
    screenshotUrls: [`${ROOT_URL}/screenshot.png`],
    heroImageUrl: `${ROOT_URL}/hero.png`,
    webhookUrl: `${ROOT_URL}/api/webhook`,

    // Categorization
    primaryCategory: 'games',
    tags: ['pixel-art', 'nft', 'collaborative', 'base', 'onchain'],

    // Open Graph metadata (max 30 chars for tagline/ogTitle)
    tagline: 'Onchain pixel art canvas',
    ogTitle: 'Pixelate - Pixel Canvas',
    ogDescription:
      'Join the collaborative pixel canvas on Base. Place pixels and mint moments as NFTs.',
    ogImageUrl: `${ROOT_URL}/og-image.png`,
  },
} as const;

export type MiniKitConfig = typeof minikitConfig;

