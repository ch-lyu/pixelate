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

export type Pixel = {
  color: number;
  lastPlacer: `0x${string}`;
  lastPlacedAt: bigint;
};

