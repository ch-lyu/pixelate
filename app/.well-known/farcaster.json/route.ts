import { NextResponse } from 'next/server';
import { minikitConfig } from '../../../minikit.config';

/**
 * Serves the Farcaster manifest for Mini App discovery.
 * This endpoint is required for Base Mini Apps.
 */
export async function GET() {
  const { accountAssociation, miniapp } = minikitConfig;

  const manifest = {
    accountAssociation: {
      header: accountAssociation.header,
      payload: accountAssociation.payload,
      signature: accountAssociation.signature,
    },
    frame: {
      version: miniapp.version,
      name: miniapp.name,
      subtitle: miniapp.subtitle,
      description: miniapp.description,
      iconUrl: miniapp.iconUrl,
      imageUrl: miniapp.heroImageUrl,
      splashImageUrl: miniapp.splashImageUrl,
      splashBackgroundColor: miniapp.splashBackgroundColor,
      homeUrl: miniapp.homeUrl,
      webhookUrl: miniapp.webhookUrl,
      primaryCategory: miniapp.primaryCategory,
      tags: miniapp.tags,
      screenshotUrls: miniapp.screenshotUrls,
      heroImageUrl: miniapp.heroImageUrl,
      tagline: miniapp.tagline,
      ogTitle: miniapp.ogTitle,
      ogDescription: miniapp.ogDescription,
      ogImageUrl: miniapp.ogImageUrl,
    },
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

