'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useWatchContractEvent } from 'wagmi';
import { parseEther } from 'viem';
import { Camera, Loader2, Check, X } from 'lucide-react';
import { PIXELATE_ADDRESS, PIXELATE_ABI, PIXELATE_SNAPSHOTS_ADDRESS, PIXELATE_SNAPSHOTS_ABI, type Pixel } from './contract';
import { PALETTE, pixelsToBlob } from './utils';
import { uploadToIPFS, getIPFSGatewayUrl } from './utils/ipfs';

const GRID_SIZE = 64;

// Shorten address for display: 0x1234...5678
const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

// Format relative time: "42s ago", "3m ago", etc.
const formatTimeAgo = (timestamp: bigint): string => {
  if (timestamp === BigInt(0)) return 'never';
  const now = Math.floor(Date.now() / 1000);
  const seconds = now - Number(timestamp);
  if (seconds < 0) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

// Zero address for checking unplaced pixels
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

type SnapshotState = 'idle' | 'capturing' | 'uploading' | 'minting' | 'success' | 'error';

export default function Home() {
  const { address, isConnected } = useAccount();
  const [selectedColor, setSelectedColor] = useState(1);
  const [hoveredPixel, setHoveredPixel] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [pendingPixel, setPendingPixel] = useState<{ index: number; color: number } | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [zoom, setZoom] = useState(1);

  // Snapshot state
  const [snapshotState, setSnapshotState] = useState<SnapshotState>('idle');
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [lastSnapshotUrl, setLastSnapshotUrl] = useState<string | null>(null);

  // Ref to track pending pixel (avoids stale closure in event callback)
  const pendingPixelRef = useRef<{ index: number; color: number } | null>(null);

  // Local pixel state for live updates
  const [localPixels, setLocalPixels] = useState<Pixel[] | null>(null);

  // Read all pixels from the contract (initial load only)
  const { data: pixelData, isLoading: isLoadingPixels } = useReadContract({
    address: PIXELATE_ADDRESS,
    abi: PIXELATE_ABI,
    functionName: 'getAllPixels',
  });

  // Read mint price from snapshots contract
  const { data: mintPrice } = useReadContract({
    address: PIXELATE_SNAPSHOTS_ADDRESS,
    abi: PIXELATE_SNAPSHOTS_ABI,
    functionName: 'mintPrice',
  });

  // Sync contract data to local state on initial load
  useEffect(() => {
    if (pixelData && !localPixels) {
      // Convert readonly array to mutable Pixel array with proper types
      const converted: Pixel[] = [...pixelData].map((p) => ({
        color: p.color,
        lastPlacer: p.lastPlacer,
        lastPlacedAt: BigInt(p.lastPlacedAt),
      }));
      setLocalPixels(converted);
    }
  }, [pixelData, localPixels]);

  // Subscribe to PixelPlaced events for live updates
  useWatchContractEvent({
    address: PIXELATE_ADDRESS,
    abi: PIXELATE_ABI,
    eventName: 'PixelPlaced',
    onLogs(logs) {
      logs.forEach((log) => {
        const { pixelId, color, placer } = log.args as {
          pixelId: bigint;
          color: number;
          placer: `0x${string}`;
        };

        const index = Number(pixelId);
        const x = index % GRID_SIZE;
        const y = Math.floor(index / GRID_SIZE);

        console.log(`[Pixelate] 🔴 LIVE: ${shortenAddress(placer)} placed pixel at (${x}, ${y}) color=${color}`);

        // Update local state with new pixel
        setLocalPixels((prev) => {
          if (!prev) return prev;
          const updated = [...prev];
          updated[index] = {
            color,
            lastPlacer: placer,
            lastPlacedAt: BigInt(Math.floor(Date.now() / 1000)),
          };
          return updated;
        });

        // Clear pending if this was our pixel (use ref to avoid stale closure)
        if (pendingPixelRef.current?.index === index) {
          pendingPixelRef.current = null;
          setPendingPixel(null);
        }
      });
    },
  });

  // Read user's remaining cooldown from contract
  const { data: cooldownFromContract, refetch: refetchCooldown } = useReadContract({
    address: PIXELATE_ADDRESS,
    abi: PIXELATE_ABI,
    functionName: 'getRemainingCooldown',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Local countdown state for live display
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  // Sync contract cooldown to local state
  useEffect(() => {
    if (cooldownFromContract !== undefined) {
      setCooldownRemaining(Number(cooldownFromContract));
    }
  }, [cooldownFromContract]);

  // Tick down the countdown every second
  useEffect(() => {
    if (cooldownRemaining <= 0) return;

    const timer = setTimeout(() => {
      setCooldownRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [cooldownRemaining]);

  // Write contract hook for placing pixels
  const {
    writeContract,
    data: txHash,
    isPending: isWritePending,
    reset: resetWrite,
    error: writeError,
    isError: isWriteError,
  } = useWriteContract();

  // Write contract hook for minting snapshots
  const {
    writeContract: writeSnapshot,
    data: snapshotTxHash,
    isPending: isSnapshotPending,
    reset: resetSnapshot,
    error: snapshotWriteError,
  } = useWriteContract();

  // Wait for transaction confirmation
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: txError,
  } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Wait for snapshot transaction confirmation
  const {
    isLoading: isSnapshotConfirming,
    isSuccess: isSnapshotConfirmed,
    error: snapshotTxError,
  } = useWaitForTransactionReceipt({
    hash: snapshotTxHash,
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
      pendingPixelRef.current = null;
      setPendingPixel(null);
    }
  }, [isWriteError, writeError]);

  useEffect(() => {
    if (txError) {
      console.error('[Pixelate] ❌ Transaction error:', txError.message);
      pendingPixelRef.current = null;
      setPendingPixel(null);
    }
  }, [txError]);

  // Handle snapshot transaction success
  useEffect(() => {
    if (isSnapshotConfirmed && snapshotState === 'minting') {
      console.log('[Pixelate] 📸 Snapshot minted successfully!');
      setSnapshotState('success');
      setTimeout(() => {
        setSnapshotState('idle');
        resetSnapshot();
      }, 3000);
    }
  }, [isSnapshotConfirmed, snapshotState, resetSnapshot]);

  // Handle snapshot errors
  useEffect(() => {
    if (snapshotWriteError) {
      console.error('[Pixelate] ❌ Snapshot error:', snapshotWriteError.message);
      setSnapshotError(snapshotWriteError.message);
      setSnapshotState('error');
    }
  }, [snapshotWriteError]);

  useEffect(() => {
    if (snapshotTxError) {
      console.error('[Pixelate] ❌ Snapshot tx error:', snapshotTxError.message);
      setSnapshotError(snapshotTxError.message);
      setSnapshotState('error');
    }
  }, [snapshotTxError]);

  // Convert local state to color array for rendering
  const pixels = localPixels
    ? localPixels.map((p) => p.color)
    : Array(GRID_SIZE * GRID_SIZE).fill(0);

  // Log when pixels are loaded from chain (only once on initial load)
  useEffect(() => {
    if (pixelData && localPixels === null) {
      const allPixels = [...pixelData];
      const placedPixels = allPixels.filter(
        (p) => p.lastPlacer !== '0x0000000000000000000000000000000000000000'
      );
      console.log(`[Pixelate] 📦 Loaded canvas: ${placedPixels.length} pixels placed`);
      console.log(`[Pixelate] 👂 Listening for live pixel updates...`);

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
  }, [pixelData, localPixels]);

  // Handle successful transaction - clear pending and update pixel as backup (in case event is slow)
  useEffect(() => {
    if (isConfirmed && pendingPixelRef.current) {
      const { index, color } = pendingPixelRef.current;
      const x = index % GRID_SIZE;
      const y = Math.floor(index / GRID_SIZE);

      console.log(`[Pixelate] ✅ Transaction confirmed: ${txHash?.slice(0, 10)}... - locking pixel (${x}, ${y})`);

      // Update localPixels with the confirmed pixel
      setLocalPixels((prev) => {
        if (!prev) return prev;
        const updated = [...prev];
        updated[index] = {
          color,
          lastPlacer: address as `0x${string}`,
          lastPlacedAt: BigInt(Math.floor(Date.now() / 1000)),
        };
        return updated;
      });

      // Clear pending state
      pendingPixelRef.current = null;
      setPendingPixel(null);

      // Immediately start 60s cooldown (don't wait for refetch)
      setCooldownRemaining(5);
      refetchCooldown(); // Still refetch to sync with contract
      resetWrite();
    }
  }, [isConfirmed, txHash, address, refetchCooldown, resetWrite]);

  const handlePixelClick = (index: number) => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }

    if (cooldownRemaining > 0) {
      alert(`Cooldown active: ${cooldownRemaining} seconds remaining`);
      return;
    }

    if (isWritePending || isConfirming) {
      return; // Transaction in progress
    }

    const x = index % GRID_SIZE;
    const y = Math.floor(index / GRID_SIZE);

    console.log(`[Pixelate] 🎨 ${shortenAddress(address!)} placing pixel at (${x}, ${y}) with color ${selectedColor}`);

    const pending = { index, color: selectedColor };
    pendingPixelRef.current = pending;
    setPendingPixel(pending);

    writeContract({
      address: PIXELATE_ADDRESS,
      abi: PIXELATE_ABI,
      functionName: 'placePixel',
      args: [BigInt(x), BigInt(y), selectedColor],
    });
  };

  // Handle snapshot creation and minting
  const handleSnapshot = async () => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }

    if (snapshotState !== 'idle') return;

    try {
      // Step 1: Capture canvas
      setSnapshotState('capturing');
      setSnapshotError(null);
      console.log('[Pixelate] 📸 Capturing canvas...');

      const blob = await pixelsToBlob(pixels);
      console.log('[Pixelate] 📸 Canvas captured, size:', blob.size, 'bytes');

      // Step 2: Upload to IPFS
      setSnapshotState('uploading');
      console.log('[Pixelate] ☁️ Uploading to IPFS...');

      const timestamp = Date.now();
      const result = await uploadToIPFS(blob, `pixelate-${timestamp}.png`);

      if (!result.success || !result.ipfsUrl) {
        throw new Error(result.error || 'Failed to upload to IPFS');
      }

      console.log('[Pixelate] ☁️ Uploaded to IPFS:', result.ipfsHash);
      setLastSnapshotUrl(getIPFSGatewayUrl(result.ipfsHash!));

      // Step 3: Mint NFT
      setSnapshotState('minting');
      console.log('[Pixelate] 🎨 Minting snapshot NFT...');

      const price = mintPrice || parseEther('0.001');

      writeSnapshot({
        address: PIXELATE_SNAPSHOTS_ADDRESS,
        abi: PIXELATE_SNAPSHOTS_ABI,
        functionName: 'createAndMint',
        args: [result.ipfsUrl],
        value: price,
      });
    } catch (error) {
      console.error('[Pixelate] ❌ Snapshot error:', error);
      setSnapshotError(error instanceof Error ? error.message : 'Unknown error');
      setSnapshotState('error');
    }
  };

  const resetSnapshotState = () => {
    setSnapshotState('idle');
    setSnapshotError(null);
    resetSnapshot();
  };

  const getCoords = (index: number) => ({
    x: index % GRID_SIZE,
    y: Math.floor(index / GRID_SIZE),
  });

  const isProcessing = isWritePending || isConfirming;
  const isSnapshotProcessing = snapshotState !== 'idle' && snapshotState !== 'success' && snapshotState !== 'error';
  const canvasSize = 512 * zoom;

  const getSnapshotButtonContent = () => {
    switch (snapshotState) {
      case 'capturing':
        return (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Capturing...</span>
          </>
        );
      case 'uploading':
        return (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Uploading...</span>
          </>
        );
      case 'minting':
        return (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Minting...</span>
          </>
        );
      case 'success':
        return (
          <>
            <Check className="w-4 h-4 text-green-400" />
            <span className="text-green-400">Minted!</span>
          </>
        );
      case 'error':
        return (
          <>
            <X className="w-4 h-4 text-red-400" />
            <span className="text-red-400">Failed</span>
          </>
        );
      default:
        return (
          <>
            <Camera className="w-4 h-4" />
            <span>Snapshot</span>
          </>
        );
    }
  };

  return (
    <>
      {/* Cursor-following tooltip */}
      {hoveredPixel !== null && localPixels && localPixels[hoveredPixel]?.lastPlacer !== ZERO_ADDRESS && (
        <div
          className="fixed bg-[#0a0a0a] text-white px-3 py-2 border border-[#333] text-xs pointer-events-none z-50 rounded shadow-lg"
          style={{
            left: mousePos.x + 12,
            top: mousePos.y + 12,
          }}
        >
          <div className="text-gray-400 mb-1">
            ({getCoords(hoveredPixel).x}, {getCoords(hoveredPixel).y})
          </div>
          <div className="text-gray-500 text-[10px]">Placed by</div>
          <div className="font-mono text-[10px] text-white break-all max-w-[280px]">
            {localPixels[hoveredPixel].lastPlacer}
          </div>
          <div className="text-gray-500 text-[10px] mt-1">
            {formatTimeAgo(localPixels[hoveredPixel].lastPlacedAt)}
          </div>
        </div>
      )}

      {/* Center: Pixel Canvas */}
      <main className="flex-1 flex flex-col items-center justify-center p-8 canvas-container relative bg-[#121212]">
        <div className="relative p-4 group">
          {/* Status Bar */}
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#0a0a0a] text-white px-4 py-2 border-2 border-[#333] pixel-font text-[8px] pointer-events-none z-10 whitespace-nowrap">
            {isLoadingPixels ? (
              <span className="text-yellow-400">LOADING...</span>
            ) : isWritePending ? (
              <span className="text-yellow-400">CONFIRM IN WALLET...</span>
            ) : isConfirming ? (
              <span className="text-yellow-400">PLACING PIXEL...</span>
            ) : hoveredPixel !== null ? (
              <span>({getCoords(hoveredPixel).x}, {getCoords(hoveredPixel).y})</span>
            ) : (
              <span className="text-gray-500">HOVER OVER CANVAS</span>
            )}
          </div>

          {/* Loading Overlay */}
          {isLoadingPixels && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10 rounded">
              <div className="text-white pixel-font text-[10px]">Loading canvas...</div>
            </div>
          )}

          {/* Grid Container */}
          <div
            className={`pixel-grid overflow-hidden ${isProcessing ? 'opacity-75' : ''}`}
            style={{
              width: `${canvasSize}px`,
              height: `${canvasSize}px`,
              gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
              gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`,
              gap: showGrid ? '1px' : '0px',
            }}
          >
            {pixels.map((colorIndex, i) => {
              // Show pending pixel optimistically
              const displayColor = pendingPixel?.index === i ? pendingPixel.color : colorIndex;
              const isPending = pendingPixel?.index === i;

              return (
                <div
                  key={i}
                  className={`pixel cursor-pointer ${isPending ? 'animate-pulse' : ''}`}
                  style={{ backgroundColor: PALETTE[displayColor] || PALETTE[0] }}
                  onClick={() => handlePixelClick(i)}
                  onMouseEnter={(e) => {
                    setHoveredPixel(i);
                    setMousePos({ x: e.clientX, y: e.clientY });
                  }}
                  onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoveredPixel(null)}
                />
              );
            })}
          </div>
        </div>
      </main>

      {/* Right Sidebar: Palette */}
      <aside className="w-72 border-l-4 border-black/20 p-6 flex flex-col z-40 bg-[#1a1a1a] overflow-y-auto">
        <h2 className="pixel-font text-[10px] text-gray-500 mb-6 uppercase tracking-widest">
          COLOR KIT
        </h2>

        {/* Color Palette Grid */}
        <div className="grid grid-cols-4 gap-3">
          {PALETTE.slice(1).map((color, i) => (
            <button
              key={i + 1}
              onClick={() => setSelectedColor(i + 1)}
              disabled={isProcessing}
              className={`w-12 h-12 rounded border-2 border-black transition-transform hover:scale-110 ${
                selectedColor === i + 1 ? 'color-btn-selected accent-glow-blue' : ''
              } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        {/* Controls */}
        <div className="mt-10 space-y-6">
          {/* Snapshot Button */}
          <button
            onClick={snapshotState === 'error' ? resetSnapshotState : handleSnapshot}
            disabled={!isConnected || isSnapshotProcessing || isSnapshotPending || isSnapshotConfirming}
            className={`w-full p-4 retro-card border-white/10 flex items-center justify-center gap-2 pixel-font text-[10px] transition-all ${
              snapshotState === 'success'
                ? 'border-green-500/50 bg-green-500/10'
                : snapshotState === 'error'
                ? 'border-red-500/50 bg-red-500/10 cursor-pointer hover:bg-red-500/20'
                : isSnapshotProcessing
                ? 'opacity-75 cursor-wait'
                : 'hover:bg-white/5 cursor-pointer'
            } ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {getSnapshotButtonContent()}
          </button>

          {/* Snapshot Error Message */}
          {snapshotState === 'error' && snapshotError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-[9px] text-red-400">
              {snapshotError.slice(0, 100)}
              {snapshotError.length > 100 && '...'}
            </div>
          )}

          {/* Last Snapshot Link */}
          {lastSnapshotUrl && snapshotState === 'success' && (
            <a
              href={lastSnapshotUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 bg-green-500/10 border border-green-500/30 rounded text-[9px] text-green-400 text-center hover:bg-green-500/20 transition-colors"
            >
              View on IPFS →
            </a>
          )}

          {/* Zoom Control */}
          <div className="p-4 retro-card border-white/5">
            <div className="flex items-center justify-between mb-4">
              <span className="pixel-font text-[10px] text-gray-400">ZOOM</span>
              <span className="text-[10px] font-bold text-[#87CEEB]">x{zoom}</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.25"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full accent-[#87CEEB] h-1.5 bg-black rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Grid Toggle */}
          <div className="flex items-center justify-between px-2">
            <span className="pixel-font text-[10px] text-gray-500">GRID LINES</span>
            <button
              onClick={() => setShowGrid(!showGrid)}
              className="w-10 h-5 bg-black rounded-full relative"
            >
              <div
                className={`absolute top-1 w-3 h-3 rounded-full transition-all ${
                  showGrid
                    ? 'left-1 bg-[#87CEEB] accent-glow-blue'
                    : 'left-6 bg-gray-600'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Status/Instructions */}
        <div className="mt-auto p-4 border-2 border-dashed border-white/5 rounded text-center bg-black/20">
          {!isConnected ? (
            <p className="text-[9px] font-bold text-yellow-500 uppercase tracking-widest">
              CONNECT WALLET TO PLACE
            </p>
          ) : cooldownRemaining > 0 ? (
            <p className="text-[9px] font-bold text-yellow-500 uppercase tracking-widest">
              COOLDOWN: {cooldownRemaining}S
            </p>
          ) : (
            <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">
              CLICK TO PLACE · 5S COOLDOWN
            </p>
          )}
        </div>
      </aside>
    </>
  );
}
