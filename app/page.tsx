'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useWatchContractEvent } from 'wagmi';
import { parseEther } from 'viem';
import { Camera, X } from 'lucide-react';
import { PIXELATE_ADDRESS, PIXELATE_ABI, PIXELATE_SNAPSHOTS_ADDRESS, PIXELATE_SNAPSHOTS_ABI, type Pixel } from './contract';
import { PALETTE, pixelsToBlob } from './utils';
import { uploadToIPFS } from './utils/ipfs';

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

type MintState = 'idle' | 'uploading' | 'minting' | 'success' | 'error';

// Local snapshot stored in memory
interface LocalSnapshot {
  id: string;
  dataUrl: string;
  timestamp: number;
  pixelColors: number[];
}

export default function Home() {
  const { address, isConnected } = useAccount();
  const [selectedColor, setSelectedColor] = useState(1);
  const [hoveredPixel, setHoveredPixel] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [pendingPixel, setPendingPixel] = useState<{ index: number; color: number } | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [zoom, setZoom] = useState(1);

  // Local snapshots (stored in memory, not on chain yet)
  const [localSnapshots, setLocalSnapshots] = useState<LocalSnapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<LocalSnapshot | null>(null);
  
  // Minting state (for when user clicks mint on a snapshot)
  const [mintState, setMintState] = useState<MintState>('idle');
  const [mintError, setMintError] = useState<string | null>(null);

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

  // Handle mint transaction success
  useEffect(() => {
    if (isSnapshotConfirmed && mintState === 'minting') {
      console.log('[Pixelate] 📸 Snapshot minted successfully!');
      setMintState('success');
      // Remove the minted snapshot from local list after success
      if (selectedSnapshot) {
        setLocalSnapshots(prev => prev.filter(s => s.id !== selectedSnapshot.id));
      }
      setTimeout(() => {
        setMintState('idle');
        setSelectedSnapshot(null);
        resetSnapshot();
      }, 2000);
    }
  }, [isSnapshotConfirmed, mintState, selectedSnapshot, resetSnapshot]);

  // Handle mint errors
  useEffect(() => {
    if (snapshotWriteError) {
      console.error('[Pixelate] ❌ Mint error:', snapshotWriteError.message);
      setMintError(snapshotWriteError.message);
      setMintState('error');
    }
  }, [snapshotWriteError]);

  useEffect(() => {
    if (snapshotTxError) {
      console.error('[Pixelate] ❌ Mint tx error:', snapshotTxError.message);
      setMintError(snapshotTxError.message);
      setMintState('error');
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

  // Capture current canvas state as a local snapshot
  const handleCapture = async () => {
    console.log('[Pixelate] 📸 Capturing canvas...');
    
    try {
      const blob = await pixelsToBlob(pixels);
      const dataUrl = URL.createObjectURL(blob);
      
      const snapshot: LocalSnapshot = {
        id: `snap-${Date.now()}`,
        dataUrl,
        timestamp: Date.now(),
        pixelColors: [...pixels],
      };
      
      setLocalSnapshots(prev => [snapshot, ...prev].slice(0, 10)); // Keep max 10 snapshots
      console.log('[Pixelate] 📸 Snapshot saved locally');
    } catch (error) {
      console.error('[Pixelate] ❌ Capture error:', error);
    }
  };

  // Mint a selected snapshot as NFT
  const handleMint = async (snapshot: LocalSnapshot) => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }

    if (mintState !== 'idle') return;

    try {
      // Step 1: Upload to IPFS
      setMintState('uploading');
      setMintError(null);
      console.log('[Pixelate] ☁️ Uploading to IPFS...');

      // Convert dataUrl back to blob
      const response = await fetch(snapshot.dataUrl);
      const blob = await response.blob();
      
      const result = await uploadToIPFS(blob, `pixelate-${snapshot.timestamp}.png`);

      if (!result.success || !result.ipfsUrl) {
        throw new Error(result.error || 'Failed to upload to IPFS');
      }

      console.log('[Pixelate] ☁️ Uploaded to IPFS:', result.ipfsHash);

      // Step 2: Mint NFT
      setMintState('minting');
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
      console.error('[Pixelate] ❌ Mint error:', error);
      setMintError(error instanceof Error ? error.message : 'Unknown error');
      setMintState('error');
    }
  };

  const resetMintState = () => {
    setMintState('idle');
    setMintError(null);
    resetSnapshot();
  };

  const formatTimestamp = (ts: number) => {
    return new Date(ts).toLocaleString();
  };

  const getCoords = (index: number) => ({
    x: index % GRID_SIZE,
    y: Math.floor(index / GRID_SIZE),
  });

  const isProcessing = isWritePending || isConfirming;
  const isMintProcessing = mintState !== 'idle' && mintState !== 'success' && mintState !== 'error';
  const canvasSize = 512 * zoom;

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
      <main className="flex-1 flex flex-col items-center justify-center p-8 pb-28 canvas-container relative bg-[#121212]">
        <div className="relative p-4 group">
          {/* Status Bar */}
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#0a0a0a] text-white px-4 py-2 border-2 border-[#333] pixel-font text-[8px] pointer-events-none z-10 whitespace-nowrap">
            {selectedSnapshot ? (
              <span className="text-[#87CEEB]">📸 VIEWING SNAPSHOT</span>
            ) : isLoadingPixels ? (
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
          {isLoadingPixels && !selectedSnapshot && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10 rounded">
              <div className="text-white pixel-font text-[10px]">Loading canvas...</div>
            </div>
          )}

          {/* Snapshot View Mode */}
          {selectedSnapshot ? (
            <div
              className="relative"
              style={{
                width: `${canvasSize}px`,
                height: `${canvasSize}px`,
              }}
            >
              <img
                src={selectedSnapshot.dataUrl}
                alt="Snapshot"
                className="w-full h-full pixelated rounded"
              />
            </div>
          ) : (
            /* Live Grid Container */
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
          )}

          {/* Snapshot Controls - shown when viewing a snapshot */}
          {selectedSnapshot && (
            <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-[#0a0a0a] px-4 py-2 rounded border border-[#333]">
              <span className="pixel-font text-[8px] text-gray-400">
                {formatTimestamp(selectedSnapshot.timestamp)}
              </span>
              <button
                onClick={() => setSelectedSnapshot(null)}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded pixel-font text-[8px] text-white transition-colors"
              >
                ← LIVE
              </button>
              <button
                onClick={() => handleMint(selectedSnapshot)}
                disabled={!isConnected || isMintProcessing}
                className={`px-3 py-1 rounded pixel-font text-[8px] transition-colors ${
                  isMintProcessing
                    ? 'bg-yellow-500/20 text-yellow-400 cursor-wait'
                    : mintState === 'success'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-[#87CEEB]/20 hover:bg-[#87CEEB]/30 text-[#87CEEB]'
                } ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {mintState === 'uploading' ? '⏳ UPLOADING...' : 
                 mintState === 'minting' ? '⏳ MINTING...' : 
                 mintState === 'success' ? '✓ MINTED!' : 
                 '🎨 MINT NFT'}
              </button>
            </div>
          )}
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

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a] border-t border-white/10 px-6 py-4 z-40">
        <div className="flex items-center gap-4">
          {/* Capture Button */}
          <button
            onClick={handleCapture}
            disabled={!!selectedSnapshot}
            className={`flex-shrink-0 w-16 h-16 rounded border-2 border-dashed border-white/30 hover:border-[#87CEEB] transition-colors flex items-center justify-center ${
              selectedSnapshot ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            }`}
            title="Capture Snapshot"
          >
            <Camera className="w-6 h-6 text-gray-400" />
          </button>

          {/* Snapshots */}
          {localSnapshots.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-1 flex-1">
              {localSnapshots.map((snap) => (
                <button
                  key={snap.id}
                  onClick={() => setSelectedSnapshot(snap)}
                  className={`flex-shrink-0 relative group ${
                    selectedSnapshot?.id === snap.id
                      ? 'ring-2 ring-[#87CEEB] ring-offset-2 ring-offset-[#0a0a0a]'
                      : ''
                  }`}
                >
                  <img
                    src={snap.dataUrl}
                    alt="Snapshot"
                    className="w-16 h-16 rounded border border-white/20 hover:border-[#87CEEB] transition-colors pixelated"
                  />
                  {/* Timestamp overlay on hover */}
                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                    <span className="text-[7px] text-white text-center px-1">
                      {new Date(snap.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (selectedSnapshot?.id === snap.id) {
                        setSelectedSnapshot(null);
                      }
                      setLocalSnapshots(prev => prev.filter(s => s.id !== snap.id));
                    }}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-2.5 h-2.5 text-white" />
                  </button>
                </button>
              ))}
            </div>
          )}

          {/* Empty state text */}
          {localSnapshots.length === 0 && (
            <span className="pixel-font text-[9px] text-gray-600">
              Click the camera to capture a snapshot
            </span>
          )}
        </div>
        
        {/* Mint error message */}
        {mintState === 'error' && mintError && (
          <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-[8px] text-red-400">
            {mintError.slice(0, 100)}...
            <button onClick={resetMintState} className="ml-2 underline">Dismiss</button>
          </div>
        )}
      </div>
    </>
  );
}
