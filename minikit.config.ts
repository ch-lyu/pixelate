/**
 * MiniKit Configuration for Pixelate Mini App
 * This file configures the Farcaster manifest and embed metadata.
 */

// Root URL for your deployed Mini App
const ROOT_URL = 'https://pixelate-mocha.vercel.app';

export const minikitConfig = {
  // Account association credentials - signed manifest proving app ownership
  accountAssociation: {
    header: 'eyJmaWQiOi0xLCJ0eXBlIjoiYXV0aCIsImtleSI6IjB4M2JiMjkyMjFkRTY3Mjg0REZBM2FhMTEwRUVBNmM0NDMwRmUwRDc5YSJ9',
    payload: 'eyJkb21haW4iOiJwaXhlbGF0ZS1tb2NoYS52ZXJjZWwuYXBwIn0',
    signature: 'AAAAAAAAAAAAAAAAyhG94Fl3s2MRZwKIYr4qFzl2yhEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAiSCrVbLAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAul7REO_bo9AFv8iC11NYrLu4WEIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASQ_-6NvAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAABev3McCjrBnuWqQgq64U_BJCWuUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAPhSELIcxQMC9He6VmhtIBncm2etAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABBru-l3u2JYcrMV5bhCU5y8q7_hSY5urKFsB9SmyXTCgFyuBilH4pDG-jmWpy3IH_zHm8S-eYQXWXBqsXab5bbrBsAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAZJJkkmSSZJJkkmSSZJJkkmSSZJJkkmSSZJJkkmSSZJI',
  },

  // Mini app manifest configuration
  miniapp: {
    // Required fields
    version: '1',
    name: 'Pixelate',
    subtitle: 'Onchain Pixel Canvas',
    description:
      'A shared 64×64 pixel canvas on Base — like r/place, but onchain. Place one pixel every 5 seconds and mint your favorite moments as NFTs.',

    // URLs - these will use ROOT_URL
    homeUrl: ROOT_URL,
    iconUrl: `${ROOT_URL}/icon.svg`,
    splashImageUrl: `${ROOT_URL}/splash.svg`,
    splashBackgroundColor: '#121212',

    // Optional fields
    screenshotUrls: [`${ROOT_URL}/screenshot.svg`],
    heroImageUrl: `${ROOT_URL}/hero.svg`,
    webhookUrl: `${ROOT_URL}/api/webhook`,

    // Categorization
    primaryCategory: 'games',
    tags: ['pixel-art', 'nft', 'collaborative', 'base', 'onchain'],

    // Open Graph metadata
    tagline: 'Paint the blockchain, one pixel at a time',
    ogTitle: 'Pixelate — Onchain Pixel Canvas',
    ogDescription:
      'Join the collaborative pixel canvas on Base. Place pixels, create art together, and mint moments as NFTs.',
    ogImageUrl: `${ROOT_URL}/og-image.svg`,
  },
} as const;

export type MiniKitConfig = typeof minikitConfig;

