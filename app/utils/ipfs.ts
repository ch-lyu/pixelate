const PINATA_API_URL = 'https://api.pinata.cloud';

interface PinataResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

interface UploadResult {
  success: boolean;
  ipfsHash?: string;
  ipfsUrl?: string;
  error?: string;
}

/**
 * Upload a file (image blob) to IPFS via Pinata
 */
export async function uploadToIPFS(
  file: Blob,
  filename: string = 'snapshot.png'
): Promise<UploadResult> {
  const apiKey = process.env.NEXT_PUBLIC_PINATA_API_KEY;
  const apiSecret = process.env.NEXT_PUBLIC_PINATA_API_SECRET;

  if (!apiKey || !apiSecret) {
    return {
      success: false,
      error: 'Pinata API credentials not configured',
    };
  }

  try {
    const formData = new FormData();
    formData.append('file', file, filename);

    const metadata = JSON.stringify({
      name: filename,
      keyvalues: {
        app: 'pixelate',
        type: 'canvas-snapshot',
        timestamp: new Date().toISOString(),
      },
    });
    formData.append('pinataMetadata', metadata);

    const options = JSON.stringify({
      cidVersion: 1,
    });
    formData.append('pinataOptions', options);

    const response = await fetch(`${PINATA_API_URL}/pinning/pinFileToIPFS`, {
      method: 'POST',
      headers: {
        pinata_api_key: apiKey,
        pinata_secret_api_key: apiSecret,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Pinata upload failed: ${response.status} ${errorText}`,
      };
    }

    const data: PinataResponse = await response.json();

    return {
      success: true,
      ipfsHash: data.IpfsHash,
      ipfsUrl: `ipfs://${data.IpfsHash}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown upload error',
    };
  }
}

/**
 * Get a gateway URL for viewing IPFS content
 */
export function getIPFSGatewayUrl(ipfsHash: string): string {
  // Use Pinata gateway or public gateway
  const gateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs';
  return `${gateway}/${ipfsHash}`;
}

/**
 * Convert ipfs:// URI to gateway URL
 */
export function ipfsUriToGatewayUrl(ipfsUri: string): string {
  if (ipfsUri.startsWith('ipfs://')) {
    const hash = ipfsUri.replace('ipfs://', '');
    return getIPFSGatewayUrl(hash);
  }
  return ipfsUri;
}
