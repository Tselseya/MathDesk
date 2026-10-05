import { ALLOWED_UPLOAD_TYPES, MAX_ENCODED_IMAGE_BYTES, MAX_IMAGE_EDGE_PX, MAX_UPLOAD_BYTES } from './limits';
import type { MathDeskImage } from '../types/ai';

export type PreparedImage = MathDeskImage & { preview: string };

export class ImageRejected extends Error {}

export function base64Bytes(data: string) {
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  return Math.floor((data.length * 3) / 4) - padding;
}

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // Fall through to the <img> decoder below.
    }
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new ImageRejected('That file could not be read as an image.'));
      image.src = url;
    });
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
  return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) };
}

/**
 * Validates a user-chosen file by actually decoding it (the MIME label alone proves nothing),
 * downsizes it, and re-encodes it as JPEG so the payload sent to the AI stays small.
 */
export async function prepareImage(file: Blob): Promise<PreparedImage> {
  if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) throw new ImageRejected('Please use a PNG, JPEG, WebP or GIF image.');
  if (file.size > MAX_UPLOAD_BYTES) throw new ImageRejected('That image is larger than 8 MB. Try a smaller photo or a screenshot.');
  const decoded = await decode(file);
  try {
    if (!decoded.width || !decoded.height) throw new ImageRejected('That image looks empty.');
    const scale = Math.min(1, MAX_IMAGE_EDGE_PX / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new ImageRejected('Your browser could not process that image.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(decoded.source, 0, 0, width, height);
    for (const quality of [0.85, 0.7, 0.55]) {
      const preview = canvas.toDataURL('image/jpeg', quality);
      const data = preview.split(',')[1] ?? '';
      if (data && base64Bytes(data) <= MAX_ENCODED_IMAGE_BYTES) return { mimeType: 'image/jpeg', data, preview };
    }
    throw new ImageRejected('That image is still too large after compression. Try cropping it.');
  } finally {
    decoded.release();
  }
}
