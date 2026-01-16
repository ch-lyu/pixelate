'use client';

import { Gamepad2 } from 'lucide-react';
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
} from '@coinbase/onchainkit/wallet';
import { Avatar, Name, Address, Identity } from '@coinbase/onchainkit/identity';

export function Header() {
  return (
    <nav className="h-16 border-b-4 border-black/40 flex items-center justify-between px-4 md:px-8 bg-[#121212] relative z-50">
      <div className="flex items-center space-x-4">
        <Gamepad2 className="w-8 h-8 text-[#D64545] accent-glow-red" />
        <h1 className="pixel-font text-lg tracking-tight soft-text-shadow text-[#e5e5e5]">
          PIXELATE
        </h1>
      </div>

      <div className="flex items-center">
        <Wallet>
          <ConnectWallet className="!gap-2">
            <Name className="max-w-[120px] truncate" />
          </ConnectWallet>
          <WalletDropdown>
            <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
              <Avatar />
              <Name />
              <Address />
            </Identity>
            <WalletDropdownDisconnect />
          </WalletDropdown>
        </Wallet>
      </div>
    </nav>
  );
}
