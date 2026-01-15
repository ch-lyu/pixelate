import { getAddress } from 'viem';

// Deployed contract on Base Sepolia (with admin-adjustable cooldown)
// https://sepolia.basescan.org/address/0xfb0da4d9da241a5063c85cce1b93f6c69cd94d49
export const PIXELATE_ADDRESS = getAddress('0xfb0da4D9dA241A5063C85ccE1b93F6C69cd94d49');

export const PIXELATE_ABI = [
  {
    type: 'function',
    name: 'placePixel',
    inputs: [
      { name: 'x', type: 'uint256' },
      { name: 'y', type: 'uint256' },
      { name: 'color', type: 'uint8' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getPixel',
    inputs: [
      { name: 'x', type: 'uint256' },
      { name: 'y', type: 'uint256' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'color', type: 'uint8' },
          { name: 'lastPlacer', type: 'address' },
          { name: 'lastPlacedAt', type: 'uint40' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAllPixels',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'color', type: 'uint8' },
          { name: 'lastPlacer', type: 'address' },
          { name: 'lastPlacedAt', type: 'uint40' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPixelBatch',
    inputs: [{ name: 'pixelIds', type: 'uint256[]' }],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'color', type: 'uint8' },
          { name: 'lastPlacer', type: 'address' },
          { name: 'lastPlacedAt', type: 'uint40' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getRemainingCooldown',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getCanvasHash',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'pixels',
    inputs: [{ name: 'pixelId', type: 'uint256' }],
    outputs: [
      { name: 'color', type: 'uint8' },
      { name: 'lastPlacer', type: 'address' },
      { name: 'lastPlacedAt', type: 'uint40' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'canPlace',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'lastActionTime',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'WIDTH',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'HEIGHT',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'COOLDOWN',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'PALETTE_SIZE',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'PixelPlaced',
    inputs: [
      { name: 'pixelId', type: 'uint256', indexed: true },
      { name: 'color', type: 'uint8', indexed: false },
      { name: 'placer', type: 'address', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'error',
    name: 'XOutOfBounds',
    inputs: [
      { name: 'x', type: 'uint256' },
      { name: 'max', type: 'uint256' },
    ],
  },
  {
    type: 'error',
    name: 'YOutOfBounds',
    inputs: [
      { name: 'y', type: 'uint256' },
      { name: 'max', type: 'uint256' },
    ],
  },
  {
    type: 'error',
    name: 'InvalidColor',
    inputs: [
      { name: 'color', type: 'uint8' },
      { name: 'maxColors', type: 'uint8' },
    ],
  },
  {
    type: 'error',
    name: 'CooldownActive',
    inputs: [{ name: 'remainingSeconds', type: 'uint256' }],
  },
  {
    type: 'error',
    name: 'NotOwner',
    inputs: [],
  },
  // Admin functions
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'cooldown',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'setCooldown',
    inputs: [{ name: 'newCooldown', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferOwnership',
    inputs: [{ name: 'newOwner', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'CooldownUpdated',
    inputs: [
      { name: 'oldCooldown', type: 'uint256', indexed: false },
      { name: 'newCooldown', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'OwnershipTransferred',
    inputs: [
      { name: 'previousOwner', type: 'address', indexed: true },
      { name: 'newOwner', type: 'address', indexed: true },
    ],
  },
] as const;

export const PIXELATE_SNAPSHOTS_ADDRESS = '0x10da06ba8d3521103217d6a3c418c8903c3c38b0' as const;

export const PIXELATE_SNAPSHOTS_ABI = [
  // Constructor reference
  {
    type: 'function',
    name: 'PIXELATE',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  // State variables
  {
    type: 'function',
    name: 'mintPrice',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // Snapshot struct via mapping
  {
    type: 'function',
    name: 'snapshots',
    inputs: [{ name: 'snapshotId', type: 'uint256' }],
    outputs: [
      { name: 'blockNumber', type: 'uint256' },
      { name: 'timestamp', type: 'uint256' },
      { name: 'canvasHash', type: 'bytes32' },
      { name: 'imageURI', type: 'string' },
      { name: 'creator', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'tokenToSnapshot',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'hashToSnapshot',
    inputs: [{ name: 'canvasHash', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // Core functions
  {
    type: 'function',
    name: 'createSnapshot',
    inputs: [{ name: 'imageURI', type: 'string' }],
    outputs: [{ name: 'snapshotId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'mintSnapshot',
    inputs: [{ name: 'snapshotId', type: 'uint256' }],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'createAndMint',
    inputs: [{ name: 'imageURI', type: 'string' }],
    outputs: [
      { name: 'snapshotId', type: 'uint256' },
      { name: 'tokenId', type: 'uint256' },
    ],
    stateMutability: 'payable',
  },
  // View functions
  {
    type: 'function',
    name: 'getSnapshot',
    inputs: [{ name: 'snapshotId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'blockNumber', type: 'uint256' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'canvasHash', type: 'bytes32' },
          { name: 'imageURI', type: 'string' },
          { name: 'creator', type: 'address' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTokenSnapshot',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getUserSnapshots',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getUserSnapshotCount',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalSnapshots',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalMinted',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // Owner functions
  {
    type: 'function',
    name: 'setMintPrice',
    inputs: [{ name: 'newPrice', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'withdraw',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // ERC721 standard functions
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'ownerOf',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'tokenURI',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  // Events
  {
    type: 'event',
    name: 'SnapshotCreated',
    inputs: [
      { name: 'snapshotId', type: 'uint256', indexed: true },
      { name: 'canvasHash', type: 'bytes32', indexed: false },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'blockNumber', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'SnapshotMinted',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'snapshotId', type: 'uint256', indexed: true },
      { name: 'minter', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'tokenId', type: 'uint256', indexed: true },
    ],
  },
  // Errors
  {
    type: 'error',
    name: 'SnapshotAlreadyExists',
    inputs: [
      { name: 'canvasHash', type: 'bytes32' },
      { name: 'existingSnapshotId', type: 'uint256' },
    ],
  },
  {
    type: 'error',
    name: 'SnapshotDoesNotExist',
    inputs: [{ name: 'snapshotId', type: 'uint256' }],
  },
  {
    type: 'error',
    name: 'OnlyCreatorCanMint',
    inputs: [
      { name: 'creator', type: 'address' },
      { name: 'caller', type: 'address' },
    ],
  },
  {
    type: 'error',
    name: 'InsufficientPayment',
    inputs: [
      { name: 'required', type: 'uint256' },
      { name: 'provided', type: 'uint256' },
    ],
  },
  {
    type: 'error',
    name: 'InvalidImageURI',
    inputs: [],
  },
  {
    type: 'error',
    name: 'WithdrawFailed',
    inputs: [],
  },
] as const;

// Type for pixel data returned from contract
export type Pixel = {
  color: number;
  lastPlacer: `0x${string}`;
  lastPlacedAt: bigint;
};

// Type for snapshot data returned from contract
export type Snapshot = {
  blockNumber: bigint;
  timestamp: bigint;
  canvasHash: `0x${string}`;
  imageURI: string;
  creator: `0x${string}`;
};

