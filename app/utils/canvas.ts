const GRID_SIZE = 64;
const PIXEL_SIZE = 16; // Size of each pixel in the exported image (64x16 = 1024px)

/**
 * The 32-color palette used by Pixelate
 */
export const PALETTE = [
  '#2A2A2A', // 0: Default/unplaced (grey)
  // Warm tones (1-7)
  '#FF6969', '#FF4191', '#E4003A', '#FF7F3E', '#F9D689', '#FFD635', '#FFA800',
  // Cool tones (8-15)
  '#37B7C3', '#0083C7', '#0052FF', '#0000EA', '#9B86BD', '#604CC3', '#820080', '#CF6EE4',
  // Nature tones (16-23)
  '#0A6847', '#02BE01', '#94E044', '#597445', '#91DDCF', '#00D3DD', '#00CCC0', '#00A368',
  // Neutrals & accents (24-32)
  '#FFFFFF', '#E5E1DA', '#C4C4C4', '#888888', '#640D6B', '#561C24', '#A06A42', '#6D482F', '#000000',
];

/**
 * Render pixel data to a canvas element
 * @param pixels Array of color indices (0-31)
 * @param pixelSize Size of each pixel in the output (default 16 = 1024x1024 image)
 * @returns HTMLCanvasElement with rendered pixels
 */
export function renderPixelsToCanvas(
  pixels: number[],
  pixelSize: number = PIXEL_SIZE
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const size = GRID_SIZE * pixelSize;
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas 2D context');
  }

  // Render each pixel
  for (let i = 0; i < pixels.length; i++) {
    const x = (i % GRID_SIZE) * pixelSize;
    const y = Math.floor(i / GRID_SIZE) * pixelSize;
    const colorIndex = pixels[i];
    ctx.fillStyle = PALETTE[colorIndex] || PALETTE[0];
    ctx.fillRect(x, y, pixelSize, pixelSize);
  }

  return canvas;
}

/**
 * Convert pixel data to a PNG blob
 * @param pixels Array of color indices (0-31)
 * @param pixelSize Size of each pixel in the output
 * @returns Promise<Blob> PNG image blob
 */
export async function pixelsToBlob(
  pixels: number[],
  pixelSize: number = PIXEL_SIZE
): Promise<Blob> {
  const canvas = renderPixelsToCanvas(pixels, pixelSize);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob from canvas'));
        }
      },
      'image/png',
      1.0
    );
  });
}

/**
 * Convert pixel data to a data URL
 * @param pixels Array of color indices (0-31)
 * @param pixelSize Size of each pixel in the output
 * @returns Data URL string (base64 encoded PNG)
 */
export function pixelsToDataUrl(
  pixels: number[],
  pixelSize: number = PIXEL_SIZE
): string {
  const canvas = renderPixelsToCanvas(pixels, pixelSize);
  return canvas.toDataURL('image/png');
}

/**
 * Download pixel data as a PNG file
 * @param pixels Array of color indices (0-31)
 * @param filename Filename for the download
 */
export function downloadPixelsAsPng(
  pixels: number[],
  filename: string = 'pixelate-snapshot.png'
): void {
  const dataUrl = pixelsToDataUrl(pixels);
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
