'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { PIXELATE_ADDRESS, PIXELATE_ABI, type Pixel } from './contract';

const GRID_SIZE = 64;

// Shorten address for display: 0x1234...5678
const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

const PALETTE = [
  '#2A2A2A', // Index 0: Default/unplaced (grey)
  '#FF6969', '#FF4191', '#E4003A', '#FF7F3E', '#F9D689', '#FFD635', '#FFA800', // Warm tones (1-7)
  '#37B7C3', '#0083C7', '#0052FF', '#0000EA', '#9B86BD', '#604CC3', '#820080', '#CF6EE4', // Cool tones (8-15)
  '#0A6847', '#02BE01', '#94E044', '#597445', '#91DDCF', '#00D3DD', '#00CCC0', '#00A368', // Nature tones (16-23)
  '#FFFFFF', '#E5E1DA', '#C4C4C4', '#888888', '#640D6B', '#561C24', '#A06A42', '#6D482F', // Neutrals (24-31)
];

export default function Home() {
  const { address, isConnected } = useAccount();
  const [selectedColor, setSelectedColor] = useState(1);
  const [hoveredPixel, setHoveredPixel] = useState<number | null>(null);
  const [pendingPixel, setPendingPixel] = useState<{ index: number; color: number } | null>(null);

  // Read all pixels from the contract
  const { data: pixelData, isLoading: isLoadingPixels, refetch: refetchPixels } = useReadContract({
    address: PIXELATE_ADDRESS,
    abi: PIXELATE_ABI,
    functionName: 'getAllPixels',
  });

  // Read user's remaining cooldown
  const { data: cooldownRemaining, refetch: refetchCooldown } = useReadContract({
    address: PIXELATE_ADDRESS,
    abi: PIXELATE_ABI,
    functionName: 'getRemainingCooldown',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Write contract hook for placing pixels
  const { 
    writeContract, 
    data: txHash, 
    isPending: isWritePending, 
    reset: resetWrite,
    error: writeError,
    isError: isWriteError,
  } = useWriteContract();

  // Wait for transaction confirmation
  const { 
    isLoading: isConfirming, 
    isSuccess: isConfirmed,
    error: txError,
  } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Log transaction lifecycle
  useEffect(() => {
    if (txHash) {
      console.log(`[Pixelate] 📤 Transaction submitted: ${txHash}`);
    }
  }, [txHash]);

  useEffect(() => {
    if (isWriteError && writeError) {
      console.error('[Pixelate] ❌ Write error:', writeError.message);
      setPendingPixel(null);
    }
  }, [isWriteError, writeError]);

  useEffect(() => {
    if (txError) {
      console.error('[Pixelate] ❌ Transaction error:', txError.message);
      setPendingPixel(null);
    }
  }, [txError]);

  // Convert contract data to color array for rendering
  const pixels = pixelData
    ? [...pixelData].map((p) => p.color)
    : Array(GRID_SIZE * GRID_SIZE).fill(0);

  // Store full pixel data for hover info
  const pixelInfo = pixelData ? [...pixelData] : undefined;

  // Log when pixels are loaded from chain
  useEffect(() => {
    if (pixelData) {
      const allPixels = [...pixelData];
      const placedPixels = allPixels.filter(
        (p) => p.lastPlacer !== '0x0000000000000000000000000000000000000000'
      );
      console.log(`[Pixelate] 📦 Loaded canvas: ${placedPixels.length} pixels placed`);
      
      // Log first few placed pixels
      placedPixels.slice(0, 5).forEach((p) => {
        const index = allPixels.indexOf(p);
        const x = index % GRID_SIZE;
        const y = Math.floor(index / GRID_SIZE);
        console.log(`  (${x}, ${y}) color=${p.color} by ${shortenAddress(p.lastPlacer)}`);
      });
      if (placedPixels.length > 5) {
        console.log(`  ... and ${placedPixels.length - 5} more`);
      }
    }
  }, [pixelData]);

  // Refetch pixels after successful transaction
  useEffect(() => {
    if (isConfirmed && pendingPixel) {
      const x = pendingPixel.index % GRID_SIZE;
      const y = Math.floor(pendingPixel.index / GRID_SIZE);
      console.log(`[Pixelate] ✅ ${shortenAddress(address!)} placed pixel at (${x}, ${y}) - tx: ${txHash?.slice(0, 10)}...`);
      refetchPixels();
      refetchCooldown();
      setPendingPixel(null);
      resetWrite();
    }
  }, [isConfirmed, pendingPixel, address, txHash, refetchPixels, refetchCooldown, resetWrite]);

  const handlePixelClick = (index: number) => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }

    if (cooldownRemaining && cooldownRemaining > BigInt(0)) {
      alert(`Cooldown active: ${cooldownRemaining} seconds remaining`);
      return;
    }

    if (isWritePending || isConfirming) {
      return; // Transaction in progress
    }

    const x = index % GRID_SIZE;
    const y = Math.floor(index / GRID_SIZE);

    console.log(`[Pixelate] 🎨 ${shortenAddress(address!)} placing pixel at (${x}, ${y}) with color ${selectedColor}`);

    setPendingPixel({ index, color: selectedColor });

    writeContract({
      address: PIXELATE_ADDRESS,
      abi: PIXELATE_ABI,
      functionName: 'placePixel',
      args: [BigInt(x), BigInt(y), selectedColor],
    });
  };

  const getCoords = (index: number) => ({
    x: index % GRID_SIZE,
    y: Math.floor(index / GRID_SIZE),
  });

  const isProcessing = isWritePending || isConfirming;

  return (
    <div className="text-white p-6 flex flex-col items-center">
      {/* Color Palette */}
      <div className="flex flex-wrap gap-3 justify-center mb-6 max-w-md">
        {PALETTE.map((color, i) => (
          <button
            key={i}
            onClick={() => setSelectedColor(i)}
            className="relative flex justify-center items-center"
            disabled={isProcessing}
          >
            <div
              className={`w-7 h-7 rounded-full border-none z-10 ${isProcessing ? 'opacity-50' : ''}`}
              style={{ backgroundColor: color }}
            />
            {selectedColor === i && (
              <div className="z-0 w-9 h-9 ring-2 ring-[#0052FF] absolute rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Status Bar */}
      <div className="h-6 mb-3 text-sm font-mono">
        {isLoadingPixels ? (
          <span className="text-yellow-400">Loading canvas...</span>
        ) : isWritePending ? (
          <span className="text-yellow-400">Confirm in wallet...</span>
        ) : isConfirming ? (
          <span className="text-yellow-400">Placing pixel...</span>
        ) : hoveredPixel !== null ? (
          <span className="text-gray-400">
            ({getCoords(hoveredPixel).x}, {getCoords(hoveredPixel).y})
          </span>
        ) : (
          <span className="text-gray-600">hover over canvas</span>
        )}
      </div>

      {/* Canvas */}
      <div className="relative">
        {isLoadingPixels && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10 rounded-lg">
            <div className="text-white">Loading...</div>
          </div>
        )}
        <div
          className={`border border-gray-800 rounded-lg overflow-hidden shadow-2xl ${isProcessing ? 'opacity-75' : ''}`}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${GRID_SIZE}, 8px)`,
            gap: 0,
          }}
        >
          {pixels.map((colorIndex, i) => {
            // Show pending pixel optimistically
            const displayColor = pendingPixel?.index === i ? pendingPixel.color : colorIndex;
            const isPending = pendingPixel?.index === i;

            return (
              <div
                key={i}
                className={`w-2 h-2 cursor-pointer transition-opacity hover:opacity-75 ${isPending ? 'animate-pulse' : ''}`}
                style={{ backgroundColor: PALETTE[displayColor] || PALETTE[0] }}
                onClick={() => handlePixelClick(i)}
                onMouseEnter={() => setHoveredPixel(i)}
                onMouseLeave={() => setHoveredPixel(null)}
              />
            );
          })}
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-6 text-sm text-gray-500 text-center">
        {!isConnected ? (
          <p>Connect wallet to place pixels</p>
        ) : cooldownRemaining && cooldownRemaining > BigInt(0) ? (
          <p className="text-yellow-500">Cooldown: {cooldownRemaining.toString()}s remaining</p>
        ) : (
          <p>Click a pixel to place · 60s cooldown</p>
        )}
      </div>
    </div>
  );
}
