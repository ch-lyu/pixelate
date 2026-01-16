'use client';

import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { coinbaseWallet } from 'wagmi/connectors';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { MiniKitProvider } from '@coinbase/onchainkit/minikit';
import sdk from '@farcaster/miniapp-sdk';

const config = createConfig({
  chains: [baseSepolia],
  connectors: [
    coinbaseWallet({
      appName: 'Pixelate',
      preference: 'smartWalletOnly',
    }),
  ],
  transports: {
    [baseSepolia.id]: http('https://sepolia.base.org'),
  },
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  // Signal MiniKit ready as soon as possible to dismiss splash screen
  useEffect(() => {
    sdk.actions.ready({}).catch(() => {
      // Not in MiniKit context
    });
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
          chain={baseSepolia}
          config={{
            appearance: {
              mode: 'dark'
            },
            wallet: {
              display: 'modal',
            }
          }}
        >
          <MiniKitProvider enabled={true} autoConnect={true}>
            {mounted ? children : null}
          </MiniKitProvider>
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
